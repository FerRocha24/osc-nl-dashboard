<?php
// GET /endpoints/osc.php
// Padrón de OSC para la tabla de la Vista Operativa.
//
// Filtros opcionales por query string (todos combinables):
//   ?municipio=Monterrey     nombre exacto del municipio
//   ?rubro=Salud y bienestar rubro exacto
//   ?estatus=Vencido         estatus documental (Completo|Pendiente|Vencido|Rechazado)
//   ?resolucion=Denegada     resolución del Registro (Pendiente|Aceptada|Denegada)
//   ?operacion=Baja          estatus de operación del padrón de la Secretaría
//   ?q=manos                 búsqueda parcial en razón social, siglas o RFC
//   ?limite=100&pagina=1     paginación (limite máx. 500)
//
// El valor "Todos" en cualquier filtro equivale a no filtrar (es lo que
// manda el FilterBar del frontend).

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $municipio = parametro('municipio');
    $rubro     = parametro('rubro');
    $estatus   = parametro('estatus');
    $resolucion = parametro('resolucion');
    $operacion  = parametro('operacion');
    $busqueda  = parametro('q');

    $limite  = parametroEntero('limite', 100, 1, 500);
    $pagina  = parametroEntero('pagina', 1, 1, 100000);
    $desplaz = ($pagina - 1) * $limite;

    // --- WHERE dinámico, siempre con marcadores (nunca concatenando valores) ---
    $condiciones = [];
    $params      = [];

    if ($municipio !== null) {
        $condiciones[] = 'm.nombre_municipio = :municipio';
        $params[':municipio'] = $municipio;
    }
    if ($rubro !== null) {
        $condiciones[] = 'o.rubro = :rubro';
        $params[':rubro'] = $rubro;
    }
    // La resolución es una columna de OSC, no un agregado: va en el WHERE y no
    // en el HAVING, así aprovecha el índice idx_estatus_revision.
    if ($resolucion !== null) {
        if (!in_array($resolucion, ['Pendiente', 'Aceptada', 'Denegada'], true)) {
            responderError("El parámetro 'resolucion' debe ser Pendiente, Aceptada o Denegada.", 422);
        }
        $condiciones[] = 'o.estatus_revision = :resolucion';
        $params[':resolucion'] = $resolucion;
    }
    // Estatus de operación tal como viene del padrón. Es columna de OSC, no un
    // agregado, así que va en el WHERE.
    if ($operacion !== null) {
        if (!in_array($operacion, ESTATUS_OPERACION, true)) {
            responderError("El parámetro 'operacion' no es un estatus válido del padrón.", 422);
        }
        $condiciones[] = 'o.estatus_operacion = :operacion';
        $params[':operacion'] = $operacion;
    }
    if ($busqueda !== null) {
        // Se usan tres marcadores distintos (no :q repetido) porque con
        // consultas preparadas nativas no se puede reutilizar el mismo nombre.
        $condiciones[] = '(o.razon_social LIKE :q1 OR o.siglas LIKE :q2 OR o.rfc LIKE :q3)';
        $params[':q1'] = $params[':q2'] = $params[':q3'] = '%' . $busqueda . '%';
    }
    $where = $condiciones ? 'WHERE ' . implode(' AND ', $condiciones) : '';

    // El estatus documental es un agregado, así que se filtra con HAVING.
    $having = '';
    if ($estatus !== null) {
        if (!in_array($estatus, ['Completo', 'Pendiente', 'Vencido', 'Rechazado'], true)) {
            responderError("El parámetro 'estatus' debe ser Completo, Pendiente, Vencido o Rechazado.", 422);
        }
        $having = 'HAVING estatus_documental = :estatus';
        $params[':estatus'] = $estatus;
    }

    $donataria = SQL_DONATARIA_VIGENTE;
    $estatusDoc = SQL_ESTATUS_DOCUMENTAL;
    $aprobados  = sqlDocumentosAprobados();

    // --- Total de filas que cumplen el filtro (para la paginación) ---
    $sqlTotal = "
        SELECT COUNT(*) FROM (
            SELECT o.id_osc, $estatusDoc AS estatus_documental
            FROM OSC o
            LEFT JOIN Municipio    m ON m.id_municipio = o.id_municipio
            LEFT JOIN Documentacion d ON d.id_osc = o.id_osc
            $where
            GROUP BY o.id_osc
            $having
        ) AS filtradas";

    $stmt = $pdo->prepare($sqlTotal);
    $stmt->execute($params);
    $total = (int) $stmt->fetchColumn();

    // --- Página de resultados ---
    $sql = "
        SELECT
            o.id_osc,
            o.no_registro,
            o.razon_social,
            o.siglas,
            o.rfc,
            o.rubro,
            o.sub_rubro,
            o.actividad_principal,
            m.nombre_municipio AS municipio,
            o.estatus_revision,
            o.estatus_operacion,
            o.fecha_registro,
            o.fecha_ultima_publicacion_dof,
            $donataria  AS donataria_vigente,
            $estatusDoc AS estatus_documental,
            $aprobados  AS documentos_aprobados,
            MAX(d.fecha_entrega) AS ultima_actualizacion
        FROM OSC o
        LEFT JOIN Municipio     m ON m.id_municipio = o.id_municipio
        LEFT JOIN Documentacion d ON d.id_osc = o.id_osc
        $where
        GROUP BY o.id_osc, m.nombre_municipio, o.estatus_revision, o.estatus_operacion
        $having
        ORDER BY o.razon_social ASC
        LIMIT :limite OFFSET :desplaz";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $clave => $valor) {
        $stmt->bindValue($clave, $valor, PDO::PARAM_STR);
    }
    $stmt->bindValue(':limite',  $limite,  PDO::PARAM_INT);
    $stmt->bindValue(':desplaz', $desplaz, PDO::PARAM_INT);
    $stmt->execute();

    // Se normalizan los tipos para que el frontend reciba números y booleanos
    // de verdad, no las cadenas que devuelve el driver de MySQL.
    $osc = array_map(static function (array $fila): array {
        $fila['id_osc'] = (int) $fila['id_osc'];
        $fila['donataria_vigente'] = (bool) $fila['donataria_vigente'];
        $fila['documentos_aprobados'] = (int) $fila['documentos_aprobados'];
        return $fila;
    }, $stmt->fetchAll());

    return [
        // Va una vez y no en cada fila: es el mismo número para todas.
        'documentos_requeridos' => count(DOCUMENTOS_REQUERIDOS),
        'total'  => $total,
        'pagina' => $pagina,
        'limite' => $limite,
        'osc'    => $osc,
    ];
});

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
//   ?asignado=3|sin          responsable de la revisión (id de cuenta, o 'sin')
//   ?q=manos                 búsqueda parcial en razón social, siglas o RFC
//   ?limite=100&pagina=1     paginación (limite máx. 500)
//
// El valor "Todos" en cualquier filtro equivale a no filtrar (es lo que
// manda el FilterBar del frontend).

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $limite  = parametroEntero('limite', 100, 1, 500);
    $pagina  = parametroEntero('pagina', 1, 1, 100000);
    $desplaz = ($pagina - 1) * $limite;

    // La construcción de filtros vive en api.php porque la asignación por lote
    // tiene que usar exactamente los mismos criterios: si no, se podrían
    // asignar organizaciones que nunca aparecieron en pantalla.
    [$where, $having, $params] = filtrosPadron($_GET);

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
            o.asignado_a_id,
            u.nombre AS asignado_a,
            MAX(d.fecha_entrega) AS ultima_actualizacion
        FROM OSC o
        LEFT JOIN Municipio     m ON m.id_municipio = o.id_municipio
        LEFT JOIN Documentacion d ON d.id_osc = o.id_osc
        LEFT JOIN Usuario       u ON u.id_usuario = o.asignado_a_id
        $where
        GROUP BY o.id_osc, m.nombre_municipio, o.estatus_revision,
                 o.estatus_operacion, o.asignado_a_id, u.nombre
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
        $fila['asignado_a_id'] = $fila['asignado_a_id'] === null ? null : (int) $fila['asignado_a_id'];
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

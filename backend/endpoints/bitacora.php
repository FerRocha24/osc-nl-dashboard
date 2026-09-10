<?php
// GET /endpoints/bitacora.php
// Movimientos registrados: quién hizo qué, sobre qué organización y cuándo.
//
//   ?desde=2026-09-01&hasta=2026-09-30   rango de fechas (inclusive)
//   ?usuario=3                            solo los de esa cuenta
//   ?osc=12                               solo los de esa organización
//   ?accion=osc.denegar                   solo ese tipo de movimiento
//   ?limite=500&pagina=1                  paginación (limite máx. 2000)
//
// Solo administradores y revisores: la bitácora dice quién hizo qué, y eso es
// información sobre el personal, no sobre el padrón.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $condiciones = [];
    $params      = [];

    $desde = parametro('desde');
    if ($desde !== null) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $desde)) {
            responderError("El parámetro 'desde' debe tener el formato AAAA-MM-DD.", 422);
        }
        $condiciones[] = 'b.fecha >= :desde';
        $params[':desde'] = $desde . ' 00:00:00';
    }

    $hasta = parametro('hasta');
    if ($hasta !== null) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $hasta)) {
            responderError("El parámetro 'hasta' debe tener el formato AAAA-MM-DD.", 422);
        }
        // Hasta el final del día: con '00:00:00' el rango excluiría todo lo
        // que ocurrió el último día, que es justo lo que se quiere incluir.
        $condiciones[] = 'b.fecha <= :hasta';
        $params[':hasta'] = $hasta . ' 23:59:59';
    }

    foreach (['usuario' => 'b.usuario_id', 'osc' => 'b.id_osc'] as $nombre => $columna) {
        $valor = parametro($nombre);
        if ($valor === null) continue;
        if (!preg_match('/^\d+$/', $valor)) {
            responderError("El parámetro '$nombre' debe ser numérico.", 422);
        }
        $condiciones[] = "$columna = :$nombre";
        $params[":$nombre"] = (int) $valor;
    }

    $accion = parametro('accion');
    if ($accion !== null) {
        if (!isset(ACCIONES_BITACORA[$accion])) {
            responderError("El parámetro 'accion' no corresponde a un movimiento conocido.", 422);
        }
        $condiciones[] = 'b.accion = :accion';
        $params[':accion'] = $accion;
    }

    $where  = $condiciones ? 'WHERE ' . implode(' AND ', $condiciones) : '';
    $limite = parametroEntero('limite', 500, 1, 2000);
    $pagina = parametroEntero('pagina', 1, 1, 100000);

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM Bitacora b $where");
    $stmt->execute($params);
    $total = (int) $stmt->fetchColumn();

    // Se une con OSC para dar el nombre y el folio: la bitácora guarda el id
    // porque es lo estable, pero un reporte que dice "organización 412" no le
    // sirve a nadie.
    $sql = "
        SELECT b.id_evento, b.fecha, b.accion, b.detalle,
               b.usuario_id, b.usuario_nombre,
               b.id_osc, o.no_registro, o.razon_social
        FROM Bitacora b
        LEFT JOIN OSC o ON o.id_osc = b.id_osc
        $where
        ORDER BY b.fecha DESC, b.id_evento DESC
        LIMIT :limite OFFSET :desplaz";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $clave => $valor) {
        $stmt->bindValue($clave, $valor, is_int($valor) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
    $stmt->bindValue(':desplaz', ($pagina - 1) * $limite, PDO::PARAM_INT);
    $stmt->execute();

    $eventos = array_map(static function (array $e): array {
        $e['id_evento'] = (int) $e['id_evento'];
        $e['id_osc']    = $e['id_osc'] === null ? null : (int) $e['id_osc'];
        $e['usuario_id']= $e['usuario_id'] === null ? null : (int) $e['usuario_id'];
        // La etiqueta legible viaja resuelta: si el frontend tuviera su propia
        // copia del catálogo, una acción nueva aparecería como código crudo.
        $e['accion_etiqueta'] = ACCIONES_BITACORA[$e['accion']] ?? $e['accion'];
        return $e;
    }, $stmt->fetchAll());

    // Resumen por persona sobre el MISMO rango, para el encabezado del reporte.
    $stmt = $pdo->prepare("
        SELECT b.usuario_nombre, COUNT(*) AS movimientos
        FROM Bitacora b $where
        GROUP BY b.usuario_nombre
        ORDER BY movimientos DESC");
    $stmt->execute($params);

    return [
        'total'     => $total,
        'pagina'    => $pagina,
        'limite'    => $limite,
        'eventos'   => $eventos,
        'por_persona' => array_map(static fn(array $r): array => [
            'nombre'      => $r['usuario_nombre'],
            'movimientos' => (int) $r['movimientos'],
        ], $stmt->fetchAll()),
    ];
}, ['GET'], roles: ['admin', 'revisor']);

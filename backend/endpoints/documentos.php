<?php
// GET /endpoints/documentos.php?osc=12
// Expediente de una OSC: los documentos que ha entregado y en qué estado está
// cada uno.
//
//   ?osc=12          documentos de esa organización
//   ?estatus=...     solo los de ese estatus (para la bandeja de revisión)
//   ?limite=&pagina= paginación
//
// No devuelve el archivo, solo sus datos. El binario se pide aparte a
// documento-archivo.php.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $osc     = parametro('osc');
    $estatus = parametro('estatus');
    $limite  = parametroEntero('limite', 100, 1, 500);
    $pagina  = parametroEntero('pagina', 1, 1, 100000);

    $condiciones = [];
    $params      = [];

    if ($osc !== null) {
        if (!preg_match('/^\d+$/', $osc)) {
            responderError("El parámetro 'osc' debe ser un id numérico.", 422);
        }
        $condiciones[] = 'd.id_osc = :osc';
        $params[':osc'] = (int) $osc;
    }
    if ($estatus !== null) {
        if (!in_array($estatus, ['Completo', 'Pendiente', 'Vencido', 'Rechazado'], true)) {
            responderError('Estatus no válido.', 422);
        }
        $condiciones[] = 'd.estatus_validacion = :estatus';
        $params[':estatus'] = $estatus;
    }
    $where = $condiciones ? 'WHERE ' . implode(' AND ', $condiciones) : '';

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM Documentacion d $where");
    $stmt->execute($params);
    $total = (int) $stmt->fetchColumn();

    $sql = "
        SELECT d.id_documento, d.id_osc, o.razon_social, o.no_registro,
               d.tipo_documento, d.nombre_original, d.tipo_mime,
               d.tamano_bytes, d.estatus_validacion,
               d.fecha_entrega, d.fecha_subida,
               d.revisado_por, d.fecha_revision, d.motivo_rechazo,
               -- Indica si hay archivo adjunto; el binario nunca viaja aquí.
               (d.nombre_almacenado IS NOT NULL) AS tiene_archivo
        FROM Documentacion d
        LEFT JOIN OSC o ON o.id_osc = d.id_osc
        $where
        ORDER BY d.fecha_subida DESC, d.id_documento DESC
        LIMIT :limite OFFSET :desplaz";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $c => $v) {
        $stmt->bindValue($c, $v, is_int($v) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
    $stmt->bindValue(':desplaz', ($pagina - 1) * $limite, PDO::PARAM_INT);
    $stmt->execute();

    $documentos = array_map(static function (array $d): array {
        $d['id_documento']  = (int) $d['id_documento'];
        $d['id_osc']        = (int) $d['id_osc'];
        $d['tamano_bytes']  = $d['tamano_bytes'] === null ? null : (int) $d['tamano_bytes'];
        $d['tiene_archivo'] = (bool) $d['tiene_archivo'];
        return $d;
    }, $stmt->fetchAll());

    return [
        'total'      => $total,
        'pagina'     => $pagina,
        'limite'     => $limite,
        'documentos' => $documentos,
        // El catálogo viaja con el expediente para que el frontend no tenga su
        // propia copia. Tenerla en dos lados fue justo lo que hizo que un RFC
        // subido a mano no contara: se llamaba distinto en cada lugar.
        'requeridos' => DOCUMENTOS_REQUERIDOS,
    ];
});

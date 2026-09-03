<?php
// GET /endpoints/kpis-apoyos.php
// Cifras del historial de inversión social 2023-2024.
//
// Devuelve:
//   total_apoyos          apoyos registrados en total
//   por_anio              desglose por año (para ver la variación)
//   osc_beneficiadas      # de OSC del padrón que recibieron al menos un apoyo
//   porcentaje_padron_beneficiado  qué tanto del padrón alcanzó la inversión
//   apoyos_sin_emparejar  apoyos cuyo nombre no coincidió con ninguna OSC
//
// Filtros opcionales: ?municipio=... y ?categoria=...

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    [$where, $params] = filtrosOsc();

    $consultar = function (string $sql) use ($pdo, $params) {
        $stmt = $pdo->prepare($sql);
        foreach ($params as $c => $v) { $stmt->bindValue($c, $v, PDO::PARAM_STR); }
        $stmt->execute();
        return $stmt;
    };

    // LEFT JOIN para no perder los apoyos sin emparejar cuando no hay filtro.
    // Con filtro activo el INNER es implícito, porque el WHERE exige municipio
    // o categoría y esos apoyos no tienen OSC asociada.
    $union = $where === '' ? 'LEFT JOIN' : 'INNER JOIN';

    $fila = $consultar("
        SELECT
            COUNT(*)                 AS total_apoyos,
            COUNT(DISTINCT a.id_osc) AS osc_beneficiadas,
            SUM(a.id_osc IS NULL)    AS sin_emparejar
        FROM Apoyos a
        $union OSC o ON o.id_osc = a.id_osc
        LEFT JOIN Municipio m ON m.id_municipio = o.id_municipio
        $where")->fetch();

    $totalPadron = (int) $consultar("
        SELECT COUNT(*) FROM OSC o
        LEFT JOIN Municipio m ON m.id_municipio = o.id_municipio
        $where")->fetchColumn();
    $beneficiadas = (int) $fila['osc_beneficiadas'];

    $porAnio = array_map(static fn(array $f): array => [
        'anio'   => (int) $f['anio'],
        'apoyos' => (int) $f['apoyos'],
    ], $consultar("
        SELECT a.anio, COUNT(*) AS apoyos
        FROM Apoyos a
        $union OSC o ON o.id_osc = a.id_osc
        LEFT JOIN Municipio m ON m.id_municipio = o.id_municipio
        $where
        GROUP BY a.anio
        ORDER BY a.anio ASC")->fetchAll());

    return [
        'total_apoyos'                  => (int) $fila['total_apoyos'],
        'osc_beneficiadas'              => $beneficiadas,
        'porcentaje_padron_beneficiado' => $totalPadron > 0
            ? round($beneficiadas * 100 / $totalPadron, 1)
            : 0.0,
        'apoyos_sin_emparejar'          => (int) $fila['sin_emparejar'],
        'por_anio'                      => $porAnio,
        'total_padron'                  => $totalPadron,
    ];
});

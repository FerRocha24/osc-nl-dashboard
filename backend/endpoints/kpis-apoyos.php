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

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $fila = $pdo->query("
        SELECT
            COUNT(*)                                   AS total_apoyos,
            COUNT(DISTINCT a.id_osc)                   AS osc_beneficiadas,
            SUM(a.id_osc IS NULL)                      AS sin_emparejar
        FROM Apoyos a
    ")->fetch();

    $totalPadron = (int) $pdo->query("SELECT COUNT(*) FROM OSC")->fetchColumn();
    $beneficiadas = (int) $fila['osc_beneficiadas'];

    $porAnio = array_map(static fn(array $f): array => [
        'anio'   => (int) $f['anio'],
        'apoyos' => (int) $f['apoyos'],
    ], $pdo->query("
        SELECT a.anio, COUNT(*) AS apoyos
        FROM Apoyos a
        GROUP BY a.anio
        ORDER BY a.anio ASC
    ")->fetchAll());

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

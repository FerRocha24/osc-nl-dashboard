<?php
// GET /endpoints/apoyos-por-tipo.php
// Apoyos agrupados por tipo de inversión social, con el desglose por año
// para poder comparar 2023 contra 2024 en barras agrupadas.
//
// La etiqueta se devuelve sin el prefijo numérico del catálogo
// ("1. Anual" -> "Anual"), pero el orden sí respeta ese número.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $etiqueta = SQL_TIPO_APOYO_ETIQUETA;
    $orden    = SQL_TIPO_APOYO_ORDEN;

    // INNER JOIN a OSC: los 2 apoyos que no se emparejaron quedan fuera al
    // filtrar, porque no se sabe a qué municipio ni categoría pertenecen.
    [$where, $params] = filtrosOsc();
    $where = $where === ''
        ? "WHERE a.tipo_apoyo IS NOT NULL AND TRIM(a.tipo_apoyo) <> ''"
        : "$where AND a.tipo_apoyo IS NOT NULL AND TRIM(a.tipo_apoyo) <> ''";

    $sql = "
        SELECT
            $etiqueta          AS tipo,
            a.tipo_apoyo       AS tipo_original,
            COUNT(*)           AS total,
            SUM(a.anio = 2023) AS anio_2023,
            SUM(a.anio = 2024) AS anio_2024
        FROM Apoyos a
        INNER JOIN OSC o ON o.id_osc = a.id_osc
        LEFT JOIN Municipio m ON m.id_municipio = o.id_municipio
        $where
        GROUP BY a.tipo_apoyo
        ORDER BY $orden ASC";

    return array_map(static fn(array $f): array => [
        'tipo'          => $f['tipo'],
        'tipo_original' => $f['tipo_original'],
        'total'         => (int) $f['total'],
        'anio_2023'     => (int) $f['anio_2023'],
        'anio_2024'     => (int) $f['anio_2024'],
    ], (function () use ($pdo, $sql, $params) {
        $stmt = $pdo->prepare($sql);
        foreach ($params as $c => $v) { $stmt->bindValue($c, $v, PDO::PARAM_STR); }
        $stmt->execute();
        return $stmt->fetchAll();
    })());
});

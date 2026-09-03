<?php
// GET /endpoints/apoyos-por-poblacion.php
// Apoyos agrupados por población objetivo, con desglose por año.
//
//   ?limite=10   cuántas poblaciones devolver (1-50, por defecto 10)
//
// OJO: el catálogo de población cambió entre 2023 y 2024 ("Niñas, niños y
// adolescentes" en 2023 pasó a ser "NNA" en 2024). Los nombres se unifican
// con SQL_POBLACION_NORMALIZADA; ver config/reglas.php para el detalle.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $limite    = parametroEntero('limite', 10, 1, 50);
    $poblacion = SQL_POBLACION_NORMALIZADA;

    [$where, $params] = filtrosOsc();
    $where = $where === ''
        ? "WHERE a.poblacion IS NOT NULL AND TRIM(a.poblacion) <> ''"
        : "$where AND a.poblacion IS NOT NULL AND TRIM(a.poblacion) <> ''";

    // Se repite la expresión completa en GROUP BY / ORDER BY en vez de usar el
    // alias: MySQL resuelve un alias que choca con el nombre de una columna
    // real a favor de la COLUMNA, así que "GROUP BY poblacion" agruparía por
    // a.poblacion (el valor crudo) y "NNA" quedaría separado de "Niñas, niños
    // y adolescentes", que es justo lo que se quiere evitar.
    $sql = "
        SELECT
            $poblacion         AS poblacion,
            COUNT(*)           AS total,
            SUM(a.anio = 2023) AS anio_2023,
            SUM(a.anio = 2024) AS anio_2024
        FROM Apoyos a
        INNER JOIN OSC o ON o.id_osc = a.id_osc
        LEFT JOIN Municipio m ON m.id_municipio = o.id_municipio
        $where
        GROUP BY $poblacion
        ORDER BY total DESC, $poblacion ASC
        LIMIT :limite";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $c => $v) { $stmt->bindValue($c, $v, PDO::PARAM_STR); }
    $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
    $stmt->execute();

    return array_map(static fn(array $f): array => [
        'poblacion' => $f['poblacion'],
        'total'     => (int) $f['total'],
        'anio_2023' => (int) $f['anio_2023'],
        'anio_2024' => (int) $f['anio_2024'],
    ], $stmt->fetchAll());
});

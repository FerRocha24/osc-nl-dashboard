<?php
// GET /endpoints/distribucion-rubro.php
// Conteo de OSC por rubro, para la gráfica de dona de la Vista Estratégica.
//
//   ?detalle=1          devuelve los 82 rubros específicos en vez de categorías
//   ?limite=10          máximo de filas (1-100)
//   ?municipio=...      filtra por municipio
//   ?categoria=...      filtra por categoría de rubro
//
// Por defecto agrupa en las 9 categorías de SQL_CATEGORIA_RUBRO. El padrón
// solo trae el rubro específico, y 82 rebanadas no comunican nada; con el
// detalle se puede seguir consultando el desglose fino.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $detalle = ($_GET['detalle'] ?? '') === '1';
    $limite  = parametroEntero('limite', 100, 1, 100);

    // Se repite la expresión en GROUP BY en vez de usar el alias: si el alias
    // choca con el nombre de una columna real, MySQL agrupa por la columna.
    $agrupador = $detalle
        ? "COALESCE(NULLIF(TRIM(o.rubro), ''), 'Sin clasificar')"
        : SQL_CATEGORIA_RUBRO;

    [$where, $params] = filtrosOsc();

    $sql = "
        SELECT $agrupador AS rubro,
               COUNT(*)   AS total
        FROM OSC o
        LEFT JOIN Municipio m ON m.id_municipio = o.id_municipio
        $where
        GROUP BY $agrupador
        ORDER BY total DESC, rubro ASC
        LIMIT :limite";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $clave => $valor) {
        $stmt->bindValue($clave, $valor, PDO::PARAM_STR);
    }
    $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
    $stmt->execute();

    return array_map(static fn(array $f): array => [
        'rubro' => $f['rubro'],
        'total' => (int) $f['total'],
    ], $stmt->fetchAll());
});

<?php
// GET /endpoints/distribucion-rubro.php
// Conteo de OSC agrupado por rubro, para la gráfica de dona de la
// Vista Estratégica. Ordenado de mayor a menor.
//
//   ?limite=10   cuántos rubros devolver como máximo (1–100, por defecto todos)

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $limite = parametroEntero('limite', 100, 1, 100);

    // Las OSC sin rubro capturado se agrupan bajo "Sin clasificar" en lugar
    // de desaparecer del total.
    $sql = "
        SELECT COALESCE(NULLIF(TRIM(o.rubro), ''), 'Sin clasificar') AS rubro,
               COUNT(*) AS total
        FROM OSC o
        GROUP BY rubro
        ORDER BY total DESC, rubro ASC
        LIMIT :limite";

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
    $stmt->execute();

    return array_map(static fn(array $f): array => [
        'rubro' => $f['rubro'],
        'total' => (int) $f['total'],
    ], $stmt->fetchAll());
});

<?php
// GET /endpoints/beneficiarios-por-edad.php
// Suma de beneficiarios por rango de edad y género, para la gráfica de
// barras apiladas de la Vista Estratégica.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    // `rango_edad` es texto ("0-11", "12-17", "60+"), así que ordenar
    // alfabéticamente pondría "12-17" antes que "0-11". Se ordena por el
    // número inicial del rango para que salga en orden etario real.
    $sql = "
        SELECT b.rango_edad                AS rango,
               COALESCE(SUM(b.num_hombres), 0) AS hombres,
               COALESCE(SUM(b.num_mujeres), 0) AS mujeres
        FROM Beneficiarios b
        GROUP BY b.rango_edad
        ORDER BY CAST(SUBSTRING_INDEX(b.rango_edad, '-', 1) AS UNSIGNED) ASC,
                 b.rango_edad ASC";

    return array_map(static function (array $f): array {
        $hombres = (int) $f['hombres'];
        $mujeres = (int) $f['mujeres'];
        return [
            'rango'   => $f['rango'],
            'hombres' => $hombres,
            'mujeres' => $mujeres,
            'total'   => $hombres + $mujeres,
        ];
    }, $pdo->query($sql)->fetchAll());
});

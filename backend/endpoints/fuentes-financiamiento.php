<?php
// GET /endpoints/fuentes-financiamiento.php
// Promedio del porcentaje de financiamiento por tipo de fuente, para la
// gráfica de barras horizontales de la Vista Estratégica.
//
// El promedio se calcula solo entre las OSC que efectivamente reportaron
// esa fuente (no se cuenta como 0 a quien no la usa), que es la lectura
// correcta de "cuánto pesa esta fuente cuando una OSC recurre a ella".

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $esPublica = SQL_FUENTE_ES_PUBLICA;

    $sql = "
        SELECT f.tipo_fuente AS fuente,
               ROUND(AVG(f.porcentaje), 1) AS porcentaje,
               COUNT(DISTINCT f.id_osc)    AS num_osc,
               MAX($esPublica)             AS es_publica
        FROM Fuente_Financiamiento f
        GROUP BY f.tipo_fuente
        ORDER BY porcentaje DESC, fuente ASC";

    return array_map(static fn(array $f): array => [
        'fuente'     => $f['fuente'],
        'porcentaje' => aNumero($f['porcentaje']),
        'num_osc'    => (int) $f['num_osc'],
        // Permite colorear distinto las fuentes públicas en la gráfica
        'es_publica' => (bool) $f['es_publica'],
    ], $pdo->query($sql)->fetchAll());
});

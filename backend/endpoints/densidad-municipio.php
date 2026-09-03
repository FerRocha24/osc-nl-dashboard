<?php
// GET /endpoints/densidad-municipio.php
// Conteo de OSC por municipio: alimenta la gráfica de densidad y el mapa de
// calor de la Vista Estratégica.
//
//   ?limite=8           cuántos municipios devolver (1-100)
//   ?municipio=...      filtra por municipio
//   ?categoria=...      filtra por categoría de rubro
//
// INNER JOIN a propósito: los municipios sin ninguna OSC no aportan a la
// gráfica de barras. El mapa dibuja los 50 contornos por su cuenta y trata
// como cero a los que no vengan en esta respuesta.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $limite = parametroEntero('limite', 100, 1, 100);
    [$where, $params] = filtrosOsc();

    $sql = "
        SELECT m.nombre_municipio AS municipio,
               COUNT(o.id_osc)    AS total
        FROM Municipio m
        INNER JOIN OSC o ON o.id_municipio = m.id_municipio
        $where
        GROUP BY m.id_municipio, m.nombre_municipio
        ORDER BY total DESC, m.nombre_municipio ASC
        LIMIT :limite";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $clave => $valor) {
        $stmt->bindValue($clave, $valor, PDO::PARAM_STR);
    }
    $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
    $stmt->execute();

    return array_map(static fn(array $f): array => [
        'municipio' => $f['municipio'],
        'total'     => (int) $f['total'],
    ], $stmt->fetchAll());
});

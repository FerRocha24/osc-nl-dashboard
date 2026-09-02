<?php
// GET /endpoints/densidad-municipio.php
// Conteo de OSC por municipio, para la gráfica "Densidad de OSC por
// municipio" de la Vista Operativa.
//
//   ?limite=8   cuántos municipios devolver (1–100, por defecto 100)
//
// Nota: este endpoint no estaba en la lista original, pero OperativaPage.jsx
// ya dibuja esa gráfica con `densidadMunicipio` de mockData.js, así que hace
// falta para poder desconectar del todo los datos de muestra.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $limite = parametroEntero('limite', 100, 1, 100);

    // INNER JOIN a propósito: los municipios sin ninguna OSC registrada no
    // aportan nada a la gráfica de densidad.
    $sql = "
        SELECT m.nombre_municipio AS municipio,
               COUNT(o.id_osc)    AS total
        FROM Municipio m
        INNER JOIN OSC o ON o.id_municipio = m.id_municipio
        GROUP BY m.id_municipio, m.nombre_municipio
        ORDER BY total DESC, m.nombre_municipio ASC
        LIMIT :limite";

    $stmt = $pdo->prepare($sql);
    $stmt->bindValue(':limite', $limite, PDO::PARAM_INT);
    $stmt->execute();

    return array_map(static fn(array $f): array => [
        'municipio' => $f['municipio'],
        'total'     => (int) $f['total'],
    ], $stmt->fetchAll());
});

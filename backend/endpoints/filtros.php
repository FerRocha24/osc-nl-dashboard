<?php
// GET /endpoints/filtros.php
// Valores disponibles para los desplegables del FilterBar (municipios,
// rubros y estatus documentales), tomados de la base en vez de estar
// hardcodeados en el frontend.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    // Solo municipios que efectivamente tienen alguna OSC registrada.
    $municipios = $pdo->query("
        SELECT DISTINCT m.nombre_municipio
        FROM Municipio m
        INNER JOIN OSC o ON o.id_municipio = m.id_municipio
        ORDER BY m.nombre_municipio ASC
    ")->fetchAll(PDO::FETCH_COLUMN);

    $rubros = $pdo->query("
        SELECT DISTINCT TRIM(o.rubro) AS rubro
        FROM OSC o
        WHERE o.rubro IS NOT NULL AND TRIM(o.rubro) <> ''
        ORDER BY rubro ASC
    ")->fetchAll(PDO::FETCH_COLUMN);

    return [
        // "Todos" va primero porque es la opción por defecto del FilterBar
        'municipios' => array_merge(['Todos'], $municipios),
        'rubros'     => array_merge(['Todos'], $rubros),
        'estatus'    => ['Todos', 'Completo', 'Pendiente', 'Vencido'],
    ];
});

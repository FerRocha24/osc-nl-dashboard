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

    // Categorías agrupadas: es lo que filtra la Vista Estratégica, donde un
    // desplegable de 82 rubros sería inservible.
    $categoria = SQL_CATEGORIA_RUBRO;
    $categorias = $pdo->query("
        SELECT DISTINCT $categoria AS categoria
        FROM OSC o
        ORDER BY categoria ASC
    ")->fetchAll(PDO::FETCH_COLUMN);

    return [
        // "Todos" va primero porque es la opción por defecto del FilterBar
        'municipios'  => array_merge(['Todos'], $municipios),
        'rubros'      => array_merge(['Todos'], $rubros),
        'categorias'  => array_merge(['Todos'], $categorias),
        'estatus'     => ['Todos', 'Completo', 'Pendiente', 'Vencido', 'Rechazado'],
        // Resolución del Registro sobre la OSC completa, distinta del estatus
        // documental: la firma una persona.
        'resoluciones' => ['Todos', 'Pendiente', 'Aceptada', 'Denegada'],
        // Catálogo fijo y no DISTINCT de la tabla: hoy la columna está vacía
        // en las 779 (la importación que las cargó es anterior a la migración
        // 012), y un desplegable vacío parecería un error.
        'operaciones' => array_merge(['Todos'], ESTATUS_OPERACION),
    ];
});

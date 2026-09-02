<?php
// GET /endpoints/registros-por-mes.php
// Serie mensual de altas en el padrón, para la gráfica de línea de la
// Vista Operativa. Agrupa OSC.fecha_registro por mes.
//
//   ?meses=12   cuántos meses hacia atrás incluir (1–60, por defecto 12)
//
// Los meses sin altas se devuelven con registros = 0 para que la línea
// no quede con huecos.

require_once __DIR__ . '/../config/api.php';

// Abreviaturas en español; PHP daría los nombres en inglés.
const MESES_ABREVIADOS = [
    1 => 'Ene', 2 => 'Feb', 3 => 'Mar',  4 => 'Abr',  5 => 'May',  6 => 'Jun',
    7 => 'Jul', 8 => 'Ago', 9 => 'Sep', 10 => 'Oct', 11 => 'Nov', 12 => 'Dic',
];

ejecutar(function () use ($pdo) {
    $meses = parametroEntero('meses', 12, 1, 60);

    $sql = "
        SELECT DATE_FORMAT(o.fecha_registro, '%Y-%m') AS periodo,
               COUNT(*) AS registros
        FROM OSC o
        WHERE o.fecha_registro IS NOT NULL
          AND o.fecha_registro >= DATE_SUB(
                  DATE_FORMAT(CURDATE(), '%Y-%m-01'),
                  INTERVAL :meses MONTH)
        GROUP BY periodo
        ORDER BY periodo ASC";

    $stmt = $pdo->prepare($sql);
    // -1 porque el mes en curso ya cuenta como uno de los N meses pedidos.
    $stmt->bindValue(':meses', $meses - 1, PDO::PARAM_INT);
    $stmt->execute();

    // Se indexa lo que vino de la base para poder rellenar los meses vacíos.
    $conteos = [];
    foreach ($stmt->fetchAll() as $fila) {
        $conteos[$fila['periodo']] = (int) $fila['registros'];
    }

    $serie = [];
    $cursor = new DateTimeImmutable('first day of this month');
    $cursor = $cursor->modify('-' . ($meses - 1) . ' months');

    for ($i = 0; $i < $meses; $i++) {
        $periodo = $cursor->format('Y-m');
        $serie[] = [
            'periodo'   => $periodo,
            // Etiqueta corta para el eje X, p. ej. "Sep 25"
            'mes'       => MESES_ABREVIADOS[(int) $cursor->format('n')] . ' ' . $cursor->format('y'),
            'registros' => $conteos[$periodo] ?? 0,
        ];
        $cursor = $cursor->modify('+1 month');
    }

    return $serie;
});

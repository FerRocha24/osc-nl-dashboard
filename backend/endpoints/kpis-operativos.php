<?php
// GET /endpoints/kpis-operativos.php
// Los 3 indicadores de alerta de la Vista Operativa.
//
// Devuelve:
//   porcentaje_donataria_vigente     % de OSC con donataria vigente (ver reglas.php)
//   porcentaje_completitud_documental % de documentos en estatus 'Completo'
//   osc_documentacion_incompleta     # de OSC con algún documento no validado
//                                    (o sin ningún documento cargado)
//   osc_aceptadas / osc_rechazadas   # de OSC según el resultado de la revisión

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $donataria = SQL_DONATARIA_VIGENTE;

    // --- KPI 1: % de OSC con donataria vigente ---
    $sql = "
        SELECT
            COUNT(*) AS total_osc,
            SUM(CASE WHEN $donataria THEN 1 ELSE 0 END) AS con_donataria
        FROM OSC o";
    $fila = $pdo->query($sql)->fetch();

    $totalOsc      = (int) $fila['total_osc'];
    $conDonataria  = (int) $fila['con_donataria'];
    $pctDonataria  = $totalOsc > 0 ? round($conDonataria * 100 / $totalOsc, 1) : 0.0;

    // --- KPI 2: % de completitud documental ---
    // Proporción de documentos entregados que ya están validados como Completo.
    $sql = "
        SELECT
            COUNT(*) AS total_documentos,
            SUM(estatus_validacion = 'Completo') AS documentos_completos
        FROM Documentacion";
    $fila = $pdo->query($sql)->fetch();

    $totalDocs     = (int) $fila['total_documentos'];
    $docsCompletos = (int) $fila['documentos_completos'];
    $pctCompletitud = $totalDocs > 0 ? round($docsCompletos * 100 / $totalDocs, 1) : 0.0;

    // --- KPI 3: # de OSC con documentación incompleta ---
    // Cuenta tanto las que tienen documentos Pendientes/Vencidos como las
    // que no han cargado ningún documento (LEFT JOIN + COUNT = 0).
    $sql = "
        SELECT COUNT(*) FROM (
            SELECT o.id_osc
            FROM OSC o
            LEFT JOIN Documentacion d ON d.id_osc = o.id_osc
            GROUP BY o.id_osc
            HAVING COUNT(d.id_documento) = 0
                OR SUM(d.estatus_validacion <> 'Completo') > 0
        ) AS incompletas";
    $oscIncompletas = (int) $pdo->query($sql)->fetchColumn();

    // --- KPI 4: resultado de la revisión ---
    // Aceptadas y rechazadas se cuentan por OSC, no por documento: lo que se
    // decide en la ficha es el expediente completo. Se reusa la misma regla
    // que pinta la columna "Estatus documental" del padrón, para que el número
    // de la tarjeta y las filas de la tabla no se puedan contradecir.
    $estatus = SQL_ESTATUS_DOCUMENTAL;
    $sql = "
        SELECT
            SUM(estatus = 'Completo')   AS aceptadas,
            SUM(estatus = 'Rechazado')  AS rechazadas
        FROM (
            SELECT $estatus AS estatus
            FROM OSC o
            LEFT JOIN Documentacion d ON d.id_osc = o.id_osc
            GROUP BY o.id_osc
        ) AS por_osc";
    $fila = $pdo->query($sql)->fetch();

    return [
        'porcentaje_donataria_vigente'      => $pctDonataria,
        'porcentaje_completitud_documental' => $pctCompletitud,
        'osc_documentacion_incompleta'      => $oscIncompletas,
        'osc_aceptadas'                     => (int) $fila['aceptadas'],
        'osc_rechazadas'                    => (int) $fila['rechazadas'],
        // Contexto útil para depurar y para mostrar "23 de 327" en la UI
        'detalle' => [
            'total_osc'            => $totalOsc,
            'osc_con_donataria'    => $conDonataria,
            'total_documentos'     => $totalDocs,
            'documentos_completos' => $docsCompletos,
        ],
    ];
});

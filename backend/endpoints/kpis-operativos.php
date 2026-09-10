<?php
// GET /endpoints/kpis-operativos.php
// Los 3 indicadores de alerta de la Vista Operativa.
//
// Devuelve:
//   porcentaje_donataria_vigente     % de OSC con donataria vigente (ver reglas.php)
//   porcentaje_completitud_documental % de los 16 documentos requeridos por OSC
//                                    que ya están aprobados, sobre todo el padrón
//   osc_documentacion_incompleta     # de OSC con algún documento no validado
//                                    (o sin ningún documento cargado)
//   osc_aceptadas / osc_denegadas    # de OSC según la resolución del Registro
//   osc_por_resolver                 # de OSC que nadie ha resuelto todavía

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

    // Si NINGUNA organización tiene fecha de publicación en el DOF, el
    // indicador no se puede calcular y devolver 0 % sería afirmar que ninguna
    // tiene donataria vigente. No lo sabemos: el padrón importado no trae ese
    // campo. Se distingue el cero medido del dato ausente.
    $conFechaDof = (int) $pdo->query(
        'SELECT COUNT(fecha_ultima_publicacion_dof) FROM OSC'
    )->fetchColumn();
    $hayDatosDonataria = $conFechaDof > 0;

    // --- KPI 2: % de completitud documental ---
    // Se divide entre lo REQUERIDO, no entre lo entregado.
    //
    // Antes era "aprobados ÷ entregados", y eso daba 100% en cuanto una sola
    // OSC subía un documento y se lo aprobaban, aunque al padrón entero le
    // faltara casi todo. Un indicador que dice "completo" cuando falta el 99%
    // es peor que no tenerlo.
    //
    // El denominador es el catálogo cerrado de 16 documentos del padrón por
    // cada organización registrada.
    $aprobados = sqlDocumentosAprobados();
    $sql = "
        SELECT COALESCE(SUM(aprobados), 0)
        FROM (
            SELECT $aprobados AS aprobados
            FROM OSC o
            LEFT JOIN Documentacion d ON d.id_osc = o.id_osc
            GROUP BY o.id_osc
        ) AS por_osc";
    $docsCompletos = (int) $pdo->query($sql)->fetchColumn();

    $requeridosPorOsc = count(DOCUMENTOS_REQUERIDOS);
    $totalDocs = $totalOsc * $requeridosPorOsc;
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

    // --- KPI 4: resolución del Registro ---
    // Sale de la columna que firma una persona, NO de los documentos. Que
    // todos los documentos estén aprobados no significa que la OSC quedó
    // admitida: no hay una lista cerrada de cuáles debe entregar, así que
    // "completo" no se puede deducir.
    $sql = "
        SELECT
            SUM(estatus_revision = 'Aceptada')  AS aceptadas,
            SUM(estatus_revision = 'Denegada')  AS denegadas,
            SUM(estatus_revision = 'Pendiente') AS por_resolver
        FROM OSC";
    $fila = $pdo->query($sql)->fetch();

    return [
        'porcentaje_donataria_vigente'      => $hayDatosDonataria ? $pctDonataria : null,
        'porcentaje_completitud_documental' => $pctCompletitud,
        'osc_documentacion_incompleta'      => $oscIncompletas,
        'osc_aceptadas'                     => (int) $fila['aceptadas'],
        'osc_denegadas'                     => (int) $fila['denegadas'],
        'osc_por_resolver'                  => (int) $fila['por_resolver'],
        // Contexto útil para depurar y para mostrar "23 de 327" en la UI
        'faltantes' => [
            'porcentaje_donataria_vigente' => $hayDatosDonataria ? null
                : 'Se calcula con la fecha de publicación en el DOF, que el padrón actual no incluye.',
        ],
        'detalle' => [
            'total_osc'            => $totalOsc,
            'osc_con_donataria'    => $conDonataria,
            'documentos_requeridos'      => $totalDocs,
            'documentos_aprobados'       => $docsCompletos,
            'requeridos_por_organizacion' => $requeridosPorOsc,
        ],
    ];
});

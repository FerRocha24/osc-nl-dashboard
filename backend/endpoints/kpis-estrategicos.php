<?php
// GET /endpoints/kpis-estrategicos.php
// Los 4 números grandes de la Vista Estratégica.
//
// Devuelve:
//   total_osc_activas                   # de OSC en el padrón
//   total_beneficiarios                 suma de hombres + mujeres atendidos
//   porcentaje_gobernanza_formal        % de OSC con órgano de gobierno
//   porcentaje_dependencia_fondos_publicos  % promedio de financiamiento público

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $activa      = SQL_OSC_ACTIVA;
    $gobernanza  = SQL_GOBERNANZA_FORMAL;
    $esPublica   = SQL_FUENTE_ES_PUBLICA;

    // --- KPI 1: total de OSC activas ---
    $totalOsc = (int) $pdo->query("SELECT COUNT(*) FROM OSC o WHERE $activa")->fetchColumn();

    // --- KPI 2: total de beneficiarios atendidos ---
    $sql = "SELECT
                COALESCE(SUM(num_hombres), 0) AS hombres,
                COALESCE(SUM(num_mujeres), 0) AS mujeres
            FROM Beneficiarios";
    $fila = $pdo->query($sql)->fetch();
    $hombres = (int) $fila['hombres'];
    $mujeres = (int) $fila['mujeres'];

    // --- KPI 3: % de OSC con gobernanza formal ---
    // Se mide sobre el total de OSC del padrón (no solo sobre las que ya
    // llenaron su registro de transparencia), porque no tener registro de
    // transparencia también es ausencia de gobernanza documentada.
    $sql = "SELECT COUNT(*)
            FROM OSC o
            INNER JOIN Transparencia t ON t.id_osc = o.id_osc
            WHERE $activa AND $gobernanza";
    $conGobernanza = (int) $pdo->query($sql)->fetchColumn();
    $pctGobernanza = $totalOsc > 0 ? round($conGobernanza * 100 / $totalOsc, 1) : 0.0;

    // --- KPI 4: % de dependencia de fondos públicos ---
    // Primero se suma, por cada OSC, el porcentaje que viene de fuentes
    // públicas; luego se promedia ese valor entre todas las OSC que sí
    // reportaron fuentes de financiamiento.
    $sql = "
        SELECT ROUND(AVG(pct_publico), 1) FROM (
            SELECT f.id_osc,
                   SUM(CASE WHEN $esPublica THEN f.porcentaje ELSE 0 END) AS pct_publico
            FROM Fuente_Financiamiento f
            GROUP BY f.id_osc
        ) AS por_osc";
    $pctDependencia = aNumero($pdo->query($sql)->fetchColumn()) ?? 0.0;

    return [
        'total_osc_activas'                      => $totalOsc,
        'total_beneficiarios'                    => $hombres + $mujeres,
        'porcentaje_gobernanza_formal'           => $pctGobernanza,
        'porcentaje_dependencia_fondos_publicos' => $pctDependencia,
        'detalle' => [
            'beneficiarios_hombres'  => $hombres,
            'beneficiarios_mujeres'  => $mujeres,
            'osc_con_gobernanza'     => $conGobernanza,
        ],
    ];
});

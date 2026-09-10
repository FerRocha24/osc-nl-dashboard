<?php
// GET /endpoints/kpis-estrategicos.php
// Los 4 números grandes de la Vista Estratégica.
//
// Devuelve:
//   total_osc_activas                   # de OSC en el padrón
//   total_beneficiarios                 suma de hombres + mujeres atendidos
//   porcentaje_gobernanza_formal        % de OSC con órgano de gobierno
//   porcentaje_dependencia_fondos_publicos  % promedio de financiamiento público
//
// Los tres últimos son null cuando su tabla de origen está vacía, y NO cero.
// Son cosas distintas: cero es un resultado medido —"ninguna organización
// tiene órgano de gobierno"— y null es "todavía no lo sabemos". Devolver cero
// en ese caso convierte un hueco de datos en una afirmación falsa que alguien
// puede terminar citando en un informe.
//
// Filtros opcionales: ?municipio=... y ?categoria=...

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $activa      = SQL_OSC_ACTIVA;
    $gobernanza  = SQL_GOBERNANZA_FORMAL;
    $esPublica   = SQL_FUENTE_ES_PUBLICA;

    [$where, $params] = filtrosOsc();
    // filtrosOsc() ya devuelve el WHERE; se le encadena la condición de activa.
    $whereActiva = $where === '' ? "WHERE $activa" : "$where AND $activa";

    $consultar = function (string $sql) use ($pdo, $params) {
        $stmt = $pdo->prepare($sql);
        foreach ($params as $clave => $valor) {
            $stmt->bindValue($clave, $valor, PDO::PARAM_STR);
        }
        $stmt->execute();
        return $stmt;
    };

    // --- KPI 1: total de OSC activas ---
    $totalOsc = (int) $consultar("
        SELECT COUNT(*) FROM OSC o
        LEFT JOIN Municipio m ON m.id_municipio = o.id_municipio
        $whereActiva")->fetchColumn();

    // --- KPI 2: total de beneficiarios atendidos ---
    $fila = $consultar("
        SELECT COALESCE(SUM(b.num_hombres), 0) AS hombres,
               COALESCE(SUM(b.num_mujeres), 0) AS mujeres
        FROM Beneficiarios b
        INNER JOIN OSC o ON o.id_osc = b.id_osc
        LEFT JOIN Municipio m ON m.id_municipio = o.id_municipio
        $where")->fetch();
    $hombres = (int) $fila['hombres'];
    $mujeres = (int) $fila['mujeres'];

    // Se pregunta si hay filas, no si la suma da cero: una OSC podría reportar
    // legítimamente cero beneficiarios en un rango, y eso sí es un dato.
    $hayBeneficiarios = (int) $pdo->query('SELECT COUNT(*) FROM Beneficiarios')->fetchColumn() > 0;

    // --- KPI 3: % de OSC con gobernanza formal ---
    // Se mide sobre el total de OSC del padrón (no solo sobre las que ya
    // llenaron su registro de transparencia), porque no tener registro de
    // transparencia también es ausencia de gobernanza documentada.
    $conGobernanza = (int) $consultar("
        SELECT COUNT(*)
        FROM OSC o
        INNER JOIN Transparencia t ON t.id_osc = o.id_osc
        LEFT JOIN Municipio m ON m.id_municipio = o.id_municipio
        " . ($where === '' ? "WHERE $activa AND $gobernanza"
                           : "$where AND $activa AND $gobernanza"))->fetchColumn();
    $hayTransparencia = (int) $pdo->query('SELECT COUNT(*) FROM Transparencia')->fetchColumn() > 0;
    $pctGobernanza = $totalOsc > 0 ? round($conGobernanza * 100 / $totalOsc, 1) : 0.0;

    // --- KPI 4: % de dependencia de fondos públicos ---
    // Primero se suma, por cada OSC, el porcentaje que viene de fuentes
    // públicas; luego se promedia ese valor entre todas las OSC que sí
    // reportaron fuentes de financiamiento.
    $pctDependencia = aNumero($consultar("
        SELECT ROUND(AVG(pct_publico), 1) FROM (
            SELECT f.id_osc,
                   SUM(CASE WHEN $esPublica THEN f.porcentaje ELSE 0 END) AS pct_publico
            FROM Fuente_Financiamiento f
            INNER JOIN OSC o ON o.id_osc = f.id_osc
            LEFT JOIN Municipio m ON m.id_municipio = o.id_municipio
            $where
            GROUP BY f.id_osc
        ) AS por_osc")->fetchColumn());

    $hayFinanciamiento = (int) $pdo->query('SELECT COUNT(*) FROM Fuente_Financiamiento')->fetchColumn() > 0;

    return [
        'total_osc_activas'                      => $totalOsc,
        'total_beneficiarios'                    => $hayBeneficiarios ? $hombres + $mujeres : null,
        'porcentaje_gobernanza_formal'           => $hayTransparencia ? $pctGobernanza : null,
        'porcentaje_dependencia_fondos_publicos' => $hayFinanciamiento ? ($pctDependencia ?? 0.0) : null,
        // Qué falta para que cada indicador se pueda calcular. Lo consume la
        // interfaz para explicar el hueco en vez de dejar un número muerto.
        'faltantes' => [
            'total_beneficiarios' => $hayBeneficiarios ? null
                : 'El padrón importado no incluye el número de beneficiarios por organización.',
            'porcentaje_gobernanza_formal' => $hayTransparencia ? null
                : 'Requiere los datos de transparencia y órgano de gobierno, que aún no se han cargado.',
            'porcentaje_dependencia_fondos_publicos' => $hayFinanciamiento ? null
                : 'Requiere las fuentes de financiamiento de cada organización.',
        ],
        'detalle' => [
            'beneficiarios_hombres'  => $hombres,
            'beneficiarios_mujeres'  => $mujeres,
            'osc_con_gobernanza'     => $conGobernanza,
        ],
    ];
});

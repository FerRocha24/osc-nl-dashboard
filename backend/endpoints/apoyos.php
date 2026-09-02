<?php
// GET /endpoints/apoyos.php
// Historial de apoyos, filtrable. Sirve para el detalle de una OSC y para
// revisar manualmente los que no se pudieron emparejar.
//
// Filtros opcionales por query string:
//   ?osc=12              apoyos de una OSC específica (id_osc)
//   ?anio=2024           año del apoyo
//   ?tipo=1. Anual       tipo de apoyo (valor original, con prefijo)
//   ?sin_emparejar=1     solo los que quedaron sin id_osc
//   ?limite=50&pagina=1  paginación (limite máx. 500)

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $osc  = parametro('osc');
    $anio = parametro('anio');
    $tipo = parametro('tipo');
    $soloSinEmparejar = ($_GET['sin_emparejar'] ?? '') === '1';

    $limite  = parametroEntero('limite', 50, 1, 500);
    $pagina  = parametroEntero('pagina', 1, 1, 100000);
    $desplaz = ($pagina - 1) * $limite;

    $condiciones = [];
    $params      = [];

    if ($osc !== null) {
        if (!preg_match('/^\d+$/', $osc)) {
            responderError("El parámetro 'osc' debe ser el id numérico de una OSC.", 422);
        }
        $condiciones[] = 'a.id_osc = :osc';
        $params[':osc'] = (int) $osc;
    }
    if ($anio !== null) {
        if (!preg_match('/^\d{4}$/', $anio)) {
            responderError("El parámetro 'anio' debe ser un año de 4 dígitos.", 422);
        }
        $condiciones[] = 'a.anio = :anio';
        $params[':anio'] = (int) $anio;
    }
    if ($tipo !== null) {
        $condiciones[] = 'a.tipo_apoyo = :tipo';
        $params[':tipo'] = $tipo;
    }
    if ($soloSinEmparejar) {
        $condiciones[] = 'a.id_osc IS NULL';
    }
    $where = $condiciones ? 'WHERE ' . implode(' AND ', $condiciones) : '';

    $stmt = $pdo->prepare("SELECT COUNT(*) FROM Apoyos a $where");
    $stmt->execute($params);
    $total = (int) $stmt->fetchColumn();

    $poblacion = SQL_POBLACION_NORMALIZADA;
    $etiqueta  = SQL_TIPO_APOYO_ETIQUETA;

    $sql = "
        SELECT
            a.id_apoyo,
            a.id_osc,
            o.razon_social,
            o.no_registro,
            -- Se conserva el nombre tal cual venía en el archivo fuente: si el
            -- emparejamiento falló, es lo único que identifica al apoyo.
            a.nombre_organizacion_original,
            a.anio,
            a.tipo_apoyo,
            $etiqueta  AS tipo_etiqueta,
            $poblacion AS poblacion,
            a.poblacion AS poblacion_original,
            a.linea_accion,
            a.fin_proposito,
            a.alcance
        FROM Apoyos a
        LEFT JOIN OSC o ON o.id_osc = a.id_osc
        $where
        ORDER BY a.anio DESC, a.id_apoyo ASC
        LIMIT :limite OFFSET :desplaz";

    $stmt = $pdo->prepare($sql);
    foreach ($params as $clave => $valor) {
        $stmt->bindValue($clave, $valor, is_int($valor) ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->bindValue(':limite',  $limite,  PDO::PARAM_INT);
    $stmt->bindValue(':desplaz', $desplaz, PDO::PARAM_INT);
    $stmt->execute();

    $apoyos = array_map(static function (array $f): array {
        $f['id_apoyo'] = (int) $f['id_apoyo'];
        $f['id_osc']   = $f['id_osc'] === null ? null : (int) $f['id_osc'];
        $f['anio']     = (int) $f['anio'];
        return $f;
    }, $stmt->fetchAll());

    return [
        'total'  => $total,
        'pagina' => $pagina,
        'limite' => $limite,
        'apoyos' => $apoyos,
    ];
});

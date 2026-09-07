<?php
// GET /endpoints/osc-ubicaciones.php
// Puntos para el mapa de ubicaciones: solo las OSC que tienen coordenada.
//
// Va aparte de osc.php porque devuelve otra cosa: el padrón se pagina de 10 en
// 10 para una tabla, y un mapa necesita TODOS los puntos de golpe. Por eso
// también se devuelven solo los campos que el mapa dibuja o muestra al hacer
// clic, no las 44 columnas de la OSC.
//
// Filtros (mismos que la Vista Estratégica):
//   ?municipio=Monterrey
//   ?categoria=Salud y adicciones

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    // Se guardan aparte del WHERE del mapa: la cuenta total usa los mismos
    // filtros pero SIN la condición de coordenada, que es justo lo que se
    // quiere comparar.
    [$whereFiltros, $params] = filtrosOsc();

    // Las coordenadas del padrón vienen capturadas a mano y hay filas con
    // ceros o valores fuera del estado. Se acota a la caja de Nuevo León para
    // que un dato mal capturado no mande el mapa al Golfo de Guinea ni
    // descuadre el encuadre automático.
    $condicion = "o.latitud IS NOT NULL AND o.longitud IS NOT NULL
                  AND o.latitud  BETWEEN 22.5 AND 28.5
                  AND o.longitud BETWEEN -101.5 AND -98.5";
    $where = $whereFiltros === ''
        ? "WHERE $condicion"
        : "$whereFiltros AND $condicion";

    $categoria = SQL_CATEGORIA_RUBRO;

    $sql = "
        SELECT
            o.id_osc, o.no_registro, o.razon_social,
            m.nombre_municipio AS municipio,
            $categoria AS categoria,
            o.estatus_operacion,
            o.estatus_revision,
            o.latitud, o.longitud, o.origen_coordenada
        FROM OSC o
        LEFT JOIN Municipio m ON m.id_municipio = o.id_municipio
        $where
        ORDER BY o.razon_social ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);

    $puntos = array_map(static function (array $f): array {
        $f['id_osc']   = (int) $f['id_osc'];
        // Como texto, MySQL entrega DECIMAL en cadena y Leaflet necesita número.
        $f['latitud']  = (float) $f['latitud'];
        $f['longitud'] = (float) $f['longitud'];
        return $f;
    }, $stmt->fetchAll());

    // El total sin coordenada se devuelve para poder decir "se muestran 412 de
    // 779": un mapa con menos puntos de los esperados, sin explicación, parece
    // un error del tablero y no un hueco del padrón.
    $stmt = $pdo->prepare("
        SELECT COUNT(*)
        FROM OSC o
        LEFT JOIN Municipio m ON m.id_municipio = o.id_municipio
        $whereFiltros");
    $stmt->execute($params);
    $totalFiltrado = (int) $stmt->fetchColumn();

    return [
        'puntos'         => $puntos,
        'con_ubicacion'  => count($puntos),
        'total'          => $totalFiltrado,
    ];
});

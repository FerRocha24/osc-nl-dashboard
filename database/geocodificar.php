<?php
/**
 * Calcula coordenadas aproximadas a partir de la dirección escrita, para las
 * OSC que todavía no tienen la del padrón.
 *
 * Corre UNA VEZ y guarda el resultado. No se geocodifica al vuelo en cada
 * carga del tablero: la política de uso de Nominatim pide máximo una consulta
 * por segundo y prohíbe usarlo como servicio en vivo.
 *
 * CÓMO SE EVITA PONER PUNTOS EQUIVOCADOS
 *
 * Un mapa con puntos mal ubicados que se ven igual que los buenos es peor que
 * un mapa incompleto: nadie sabe cuáles creer. Así que cada resultado se
 * valida contra el municipio que dice el padrón, y lo que no coincide se
 * descarta.
 *
 * La comparación se hace por NOMBRE, con el municipio que el propio OSM
 * reporta para esa coordenada. Se probó primero validar contra los polígonos
 * del GeoJSON que dibuja el mapa de calor, y no sirve: están simplificados
 * para dibujar —Monterrey tiene 31 vértices, San Nicolás 12— y en el área
 * metropolitana, donde los municipios se entrelazan, rechazaban puntos
 * correctos. OSM valida contra sus propias fronteras, que sí son precisas.
 *
 * DOS FORMAS DE PREGUNTAR
 *
 * La consulta estructurada (calle y ciudad en campos separados) encuentra
 * mucho más que pegar todo en una cadena: en una prueba de 12 direcciones,
 * 11 contra 7. Se intenta esa primero y la libre solo como respaldo. Da igual
 * cuál responda: las dos pasan por la misma validación de municipio.
 *
 * Nunca sobrescribe una coordenada del padrón: esas son el domicilio
 * verificado y estas solo una estimación.
 *
 * Uso:
 *   php geocodificar.php               # todas las que faltan
 *   php geocodificar.php --limite=15   # prueba
 *   php geocodificar.php --seco        # no escribe, solo reporta
 */

require_once __DIR__ . '/../backend/config/database.php';

// La política de Nominatim exige identificarse con algo que permita saber
// quién opera el proceso. Un User-Agent genérico hace que bloqueen la IP.
const AGENTE = 'TableroOSC-NL/1.0 (Registro Estatal de OSC, Secretaria de Igualdad e Inclusion, Nuevo Leon)';
const PAUSA_SEGUNDOS = 1;
const ESTADO = 'Nuevo León';

function argumento(string $nombre): ?string
{
    foreach ($GLOBALS['argv'] as $a) {
        if ($a === "--$nombre") return '1';
        if (str_starts_with($a, "--$nombre=")) return substr($a, strlen($nombre) + 3);
    }
    return null;
}

/** Para comparar nombres que difieren en acentos, mayúsculas y artículos. */
function normalizar(?string $nombre): string
{
    $s = strtolower(trim(iconv('UTF-8', 'ASCII//TRANSLIT', (string) $nombre) ?: (string) $nombre));
    $s = preg_replace('/[^a-z ]/', '', $s);
    // "Aldamas, Los" y "Los Aldamas" son el mismo municipio en distintas fuentes.
    $s = preg_replace('/^(los|las|el|la)\s+/', '', $s);
    return trim(preg_replace('/\s+/', ' ', $s));
}

function consultar(array $params): ?array
{
    $url = 'https://nominatim.openstreetmap.org/search?' . http_build_query($params + [
        'format'         => 'jsonv2',
        'limit'          => 1,
        'countrycodes'   => 'mx',
        // Sin esto no se puede saber a qué municipio pertenece el punto, que
        // es toda la validación.
        'addressdetails' => 1,
    ]);
    $ctx = stream_context_create(['http' => [
        'header'  => 'User-Agent: ' . AGENTE . "\r\n",
        'timeout' => 20,
    ]]);
    $respuesta = @file_get_contents($url, false, $ctx);
    sleep(PAUSA_SEGUNDOS);
    if ($respuesta === false) return null;
    $datos = json_decode($respuesta, true);
    return $datos[0] ?? null;
}

/**
 * ¿El resultado cae en el municipio que dice el padrón?
 *
 * Se revisan varias claves porque OSM clasifica distinto según el tamaño de la
 * localidad: una ciudad grande llega como `city`, un pueblo como `town` o
 * `village`, y el municipio a veces solo aparece en `county`.
 */
function coincideMunicipio(array $resultado, string $municipioPadron): bool
{
    $dir = $resultado['address'] ?? [];
    if (normalizar($dir['state'] ?? '') !== normalizar(ESTADO)) return false;

    $esperado = normalizar($municipioPadron);
    foreach (['city', 'town', 'village', 'municipality', 'county', 'state_district'] as $clave) {
        if (isset($dir[$clave]) && normalizar($dir[$clave]) === $esperado) return true;
    }
    return false;
}

// ---------------------------------------------------------------------------

$seco   = argumento('seco') !== null;
$limite = (int) (argumento('limite') ?: 0);

// Solo las que no tienen coordenada. Las del padrón jamás se tocan, y las
// aproximadas tampoco se recalculan: repetir el proceso no debe gastar miles
// de consultas para llegar al mismo resultado.
$sql = "
    SELECT o.id_osc, o.razon_social, o.direccion, m.nombre_municipio AS municipio
    FROM OSC o
    JOIN Municipio m ON m.id_municipio = o.id_municipio
    WHERE o.latitud IS NULL
      AND o.direccion IS NOT NULL AND TRIM(o.direccion) <> ''
    ORDER BY o.id_osc";
if ($limite > 0) $sql .= " LIMIT $limite";

$filas = $pdo->query($sql)->fetchAll();
$total = count($filas);
echo "Por geocodificar: $total" . ($seco ? "  (simulación, no escribe)" : "") . "\n";
printf("Tiempo estimado: ~%d min\n\n", (int) ceil($total * 2 * PAUSA_SEGUNDOS / 60));

$guardar = $pdo->prepare("
    UPDATE OSC
    SET latitud = :lat, longitud = :lon, origen_coordenada = 'aproximada'
    WHERE id_osc = :id AND origen_coordenada IS NULL");

$ok = $otroMunicipio = $noEncontrada = 0;

foreach ($filas as $i => $f) {
    // La dirección viene como "Calle 123, Colonia, Municipio"; a Nominatim se
    // le pasa solo la calle, porque la colonia rara vez está en OSM y mete
    // ruido que hace fallar la búsqueda.
    $calle = trim(preg_split('/\s*,\s*/', $f['direccion'])[0]);

    $r = consultar([
        'street'  => $calle,
        'city'    => $f['municipio'],
        'state'   => ESTADO,
        'country' => 'México',
    ]);
    if ($r === null) {
        $r = consultar(['q' => "{$f['direccion']}, {$f['municipio']}, " . ESTADO . ", México"]);
    }

    $etiqueta = mb_strimwidth($f['razon_social'], 0, 42, '…');

    if ($r === null) {
        $noEncontrada++;
        printf("[%3d/%d] no encontrada  %s\n", $i + 1, $total, $etiqueta);
        continue;
    }
    if (!coincideMunicipio($r, $f['municipio'])) {
        $otroMunicipio++;
        printf("[%3d/%d] otro municipio %-42s (padrón dice %s)\n",
               $i + 1, $total, $etiqueta, $f['municipio']);
        continue;
    }

    $ok++;
    printf("[%3d/%d] ok             %-42s %.5f, %.5f\n",
           $i + 1, $total, $etiqueta, (float) $r['lat'], (float) $r['lon']);

    if (!$seco) {
        $guardar->execute([
            ':lat' => (float) $r['lat'],
            ':lon' => (float) $r['lon'],
            ':id'  => $f['id_osc'],
        ]);
    }
}

echo "\n--- Resumen ---\n";
echo "Ubicadas:               $ok\n";
echo "En otro municipio:      $otroMunicipio  (descartadas: el punto habría mentido)\n";
echo "Sin resultado:          $noEncontrada\n";
printf("Cobertura: %.1f%% de %d\n", $total > 0 ? $ok * 100 / $total : 0, $total);

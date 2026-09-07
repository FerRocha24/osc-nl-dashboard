<?php
// Utilidades compartidas por todos los endpoints:
// cabeceras HTTP (JSON + CORS), respuesta estándar y manejo de errores.
//
// Cada endpoint hace `require_once __DIR__ . '/../config/api.php';` y con eso
// ya tiene $pdo listo y las cabeceras puestas.

// Los avisos de PHP NUNCA deben imprimirse en la respuesta: cualquier
// "deprecated" o "notice" se colaría dentro del JSON y el frontend fallaría al
// interpretarlo, con un error que no señala la causa real. Van al log.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
error_reporting(E_ALL);

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/reglas.php';
require_once __DIR__ . '/auth.php';

// Devuelve la lista de orígenes permitidos para CORS.
//
// En producción se define CORS_ORIGENES con el dominio real del frontend
// (el de Vercel), separando varios por comas. Si no está definida se cae a "*",
// que sirve para desarrollo local pero NO debe usarse en producción: dejaría
// que cualquier página web consultara la API desde el navegador de un usuario
// que ya inició sesión.
function origenesPermitidos(): array
{
    $valor = trim((string) env('CORS_ORIGENES', ''));
    if ($valor === '') {
        return ['*'];
    }
    return array_values(array_filter(array_map('trim', explode(',', $valor))));
}

// Prepara las cabeceras y atiende el preflight de CORS.
function iniciarApi(array $metodosPermitidos = ['GET']): void
{
    header('Content-Type: application/json; charset=utf-8');

    $permitidos = origenesPermitidos();
    $origen = $_SERVER['HTTP_ORIGIN'] ?? '';

    if ($permitidos === ['*']) {
        header('Access-Control-Allow-Origin: *');
    } elseif ($origen !== '' && in_array($origen, $permitidos, true)) {
        // Se responde con el origen concreto (no con la lista) porque el
        // navegador solo acepta un valor. Vary evita que un proxy sirva a un
        // origen la respuesta cacheada de otro.
        header("Access-Control-Allow-Origin: $origen");
        header('Vary: Origin');
    }

    $metodos = implode(', ', array_unique([...$metodosPermitidos, 'OPTIONS']));
    header("Access-Control-Allow-Methods: $metodos");
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Max-Age: 600');

    // El navegador manda un OPTIONS antes del GET/POST real. Se responde vacío
    // y SIN exigir token: el preflight nunca lleva la cabecera Authorization,
    // así que pedirla aquí rompería todas las peticiones.
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }

    if (!in_array($_SERVER['REQUEST_METHOD'] ?? 'GET', $metodosPermitidos, true)) {
        responderError(
            'Método no permitido. Este endpoint solo acepta ' . implode('/', $metodosPermitidos) . '.',
            405
        );
    }
}

// Devuelve datos como JSON y termina la ejecución.
function responder(mixed $datos, int $codigo = 200): never
{
    http_response_code($codigo);
    echo json_encode(
        $datos,
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT
    );
    exit;
}

// Devuelve un error como JSON y termina la ejecución.
function responderError(string $mensaje, int $codigo = 400): never
{
    responder(['error' => $mensaje], $codigo);
}

// Envuelve la lógica del endpoint para que cualquier fallo de SQL salga
// como JSON 500 en vez de como una página de error de PHP (que rompería
// el .json() del frontend).
function ejecutar(
    callable $logica,
    array $metodos = ['GET'],
    bool $publico = false,
    array $roles = []
): never {
    iniciarApi($metodos);
    if (!$publico) {
        exigirAutenticacion();
        // Sin roles indicados basta con estar autenticado: cualquiera que
        // entró puede leer. Escribir sí se restringe.
        if ($roles !== []) {
            exigirRol(...$roles);
        }
    }
    try {
        responder($logica());
    } catch (PDOException $e) {
        error_log('Error SQL en ' . basename($_SERVER['SCRIPT_NAME'] ?? '?') . ': ' . $e->getMessage());
        responderError('Error al consultar la base de datos', 500);
    }
}

// Lee un parámetro de query string, o null si viene vacío / ausente / "Todos".
// "Todos" es el valor que usa el FilterBar del frontend para "sin filtro".
function parametro(string $nombre): ?string
{
    $valor = $_GET[$nombre] ?? null;
    if (!is_string($valor)) {
        return null;
    }
    $valor = trim($valor);
    if ($valor === '' || strcasecmp($valor, 'Todos') === 0) {
        return null;
    }
    return $valor;
}

// Lee un parámetro numérico acotado entre un mínimo y un máximo.
function parametroEntero(string $nombre, int $porDefecto, int $min, int $max): int
{
    $valor = $_GET[$nombre] ?? null;
    if (!is_string($valor) || !preg_match('/^\d+$/', trim($valor))) {
        return $porDefecto;
    }
    return max($min, min($max, (int) trim($valor)));
}

/**
 * Construye el WHERE compartido por los endpoints agregados de la Vista
 * Estratégica, a partir de los filtros de municipio y categoría de rubro.
 *
 * Devuelve [fragmentoSql, parametros]. El fragmento incluye el JOIN implícito
 * por id_municipio, así que quien lo use debe tener `OSC o` en el FROM y hacer
 * LEFT JOIN a Municipio como `m`.
 */
function filtrosOsc(): array
{
    $condiciones = [];
    $params      = [];

    $municipio = parametro('municipio');
    if ($municipio !== null) {
        $condiciones[] = 'm.nombre_municipio = :municipio';
        $params[':municipio'] = $municipio;
    }

    // Se filtra por la CATEGORÍA, no por el rubro específico: es lo que se ve
    // en la gráfica y lo que tiene sentido como filtro de una vista global.
    $categoria = parametro('categoria');
    if ($categoria !== null) {
        $condiciones[] = SQL_CATEGORIA_RUBRO . ' = :categoria';
        $params[':categoria'] = $categoria;
    }

    return [
        $condiciones ? 'WHERE ' . implode(' AND ', $condiciones) : '',
        $params,
    ];
}

// Convierte a número los campos que MySQL entrega como string vía PDO,
// para que el frontend (Recharts) reciba números y no cadenas.
function aNumero(mixed $valor, bool $entero = false): int|float|null
{
    if ($valor === null) {
        return null;
    }
    return $entero ? (int) $valor : round((float) $valor, 2);
}

/**
 * Filtros de la tabla del padrón, a partir de un arreglo de valores.
 *
 * Vive aquí y no dentro de osc.php porque la asignación por lote tiene que usar
 * EXACTAMENTE los mismos criterios: si "lo que asigno" no fuera sin ambigüedad
 * "lo que estoy viendo", una asignación masiva podría tocar organizaciones que
 * nunca aparecieron en pantalla.
 *
 * Devuelve [$where, $having, $params]. El estatus documental sale de un
 * agregado sobre Documentacion, así que va en HAVING y obliga a que quien use
 * esto agrupe por organización.
 *
 * "Todos" y la cadena vacía equivalen a no filtrar, que es lo que manda el
 * FilterBar del frontend.
 */
function filtrosPadron(array $valores): array
{
    $tomar = static function (string $clave) use ($valores): ?string {
        $v = $valores[$clave] ?? null;
        if (!is_string($v)) return null;
        $v = trim($v);
        return ($v === '' || $v === 'Todos') ? null : $v;
    };

    $condiciones = [];
    $params      = [];

    if (($municipio = $tomar('municipio')) !== null) {
        $condiciones[] = 'm.nombre_municipio = :municipio';
        $params[':municipio'] = $municipio;
    }
    if (($rubro = $tomar('rubro')) !== null) {
        $condiciones[] = 'o.rubro = :rubro';
        $params[':rubro'] = $rubro;
    }
    if (($resolucion = $tomar('resolucion')) !== null) {
        if (!in_array($resolucion, ['Pendiente', 'Aceptada', 'Denegada'], true)) {
            responderError("El parámetro 'resolucion' debe ser Pendiente, Aceptada o Denegada.", 422);
        }
        $condiciones[] = 'o.estatus_revision = :resolucion';
        $params[':resolucion'] = $resolucion;
    }
    if (($operacion = $tomar('operacion')) !== null) {
        if (!in_array($operacion, ESTATUS_OPERACION, true)) {
            responderError("El parámetro 'operacion' no es un estatus válido del padrón.", 422);
        }
        $condiciones[] = 'o.estatus_operacion = :operacion';
        $params[':operacion'] = $operacion;
    }
    if (($asignado = $tomar('asignado')) !== null) {
        if ($asignado === 'sin') {
            $condiciones[] = 'o.asignado_a_id IS NULL';
        } elseif (preg_match('/^\d+$/', $asignado)) {
            $condiciones[] = 'o.asignado_a_id = :asignado';
            $params[':asignado'] = (int) $asignado;
        } else {
            responderError("El parámetro 'asignado' debe ser un id de cuenta o 'sin'.", 422);
        }
    }
    if (($busqueda = $tomar('q')) !== null) {
        // Tres marcadores distintos y no :q repetido: con consultas preparadas
        // nativas no se puede reutilizar el mismo nombre.
        $condiciones[] = '(o.razon_social LIKE :q1 OR o.siglas LIKE :q2 OR o.rfc LIKE :q3)';
        $params[':q1'] = $params[':q2'] = $params[':q3'] = '%' . $busqueda . '%';
    }

    $having = '';
    if (($estatus = $tomar('estatus')) !== null) {
        if (!in_array($estatus, ['Completo', 'Pendiente', 'Vencido', 'Rechazado'], true)) {
            responderError("El parámetro 'estatus' debe ser Completo, Pendiente, Vencido o Rechazado.", 422);
        }
        $having = 'HAVING estatus_documental = :estatus';
        $params[':estatus'] = $estatus;
    }

    return [
        $condiciones ? 'WHERE ' . implode(' AND ', $condiciones) : '',
        $having,
        $params,
    ];
}

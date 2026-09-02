<?php
// Utilidades compartidas por todos los endpoints:
// cabeceras HTTP (JSON + CORS), respuesta estándar y manejo de errores.
//
// Cada endpoint hace `require_once __DIR__ . '/../config/api.php';` y con eso
// ya tiene $pdo listo y las cabeceras puestas.

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
function ejecutar(callable $logica, array $metodos = ['GET'], bool $publico = false): never
{
    iniciarApi($metodos);
    if (!$publico) {
        exigirAutenticacion();
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

// Convierte a número los campos que MySQL entrega como string vía PDO,
// para que el frontend (Recharts) reciba números y no cadenas.
function aNumero(mixed $valor, bool $entero = false): int|float|null
{
    if ($valor === null) {
        return null;
    }
    return $entero ? (int) $valor : round((float) $valor, 2);
}

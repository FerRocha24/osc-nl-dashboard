<?php
// Autenticación de la API por token firmado.
//
// ¿Por qué no HTTP Basic Auth? Porque el frontend es una SPA estática servida
// desde Vercel: cualquier credencial que viva en su código la puede leer quien
// abra las herramientas de desarrollo. No sería autenticación, sería un
// candado con la llave pegada.
//
// Aquí la contraseña vive SOLO en el servidor (como hash bcrypt en una
// variable de entorno). La persona la escribe en la pantalla de acceso,
// login.php la verifica y devuelve un token firmado con HMAC que el navegador
// manda en cada petición. El token no se guarda en la base: se valida con la
// firma, así que no hay estado que mantener.
//
// Variables de entorno:
//   AUTH_HABILITADA      "false" la desactiva (solo para desarrollo local)
//   AUTH_USUARIO         nombre de usuario
//   AUTH_PASSWORD_HASH   hash bcrypt; se genera con:
//                        php -r "echo password_hash('tu-password', PASSWORD_BCRYPT);"
//   APP_SECRET           cadena larga y aleatoria para firmar los tokens:
//                        php -r "echo bin2hex(random_bytes(32));"
//   AUTH_HORAS_VIGENCIA  duración del token (por defecto 12)

require_once __DIR__ . '/env.php';

function autenticacionHabilitada(): bool
{
    return strtolower((string) env('AUTH_HABILITADA', 'true')) !== 'false';
}

function secretoApp(): string
{
    $secreto = env('APP_SECRET', '');
    if ($secreto === '' || $secreto === null) {
        // Fallar ruidosamente: un secreto vacío haría que cualquiera pudiera
        // firmar sus propios tokens.
        error_log('APP_SECRET no está definida; la API no puede firmar tokens.');
        http_response_code(500);
        header('Content-Type: application/json; charset=utf-8');
        die(json_encode(['error' => 'La API no está configurada correctamente'], JSON_UNESCAPED_UNICODE));
    }
    return $secreto;
}

// base64 en su variante segura para URL (sin +, / ni =).
function b64url(string $datos): string
{
    return rtrim(strtr(base64_encode($datos), '+/', '-_'), '=');
}

function b64urlDecode(string $texto): string|false
{
    return base64_decode(strtr($texto, '-_', '+/'), true);
}

// Crea un token con el usuario y su fecha de expiración, firmado con HMAC.
function crearToken(string $usuario): array
{
    $horas = (int) (env('AUTH_HORAS_VIGENCIA', '12') ?: 12);
    $expira = time() + $horas * 3600;

    $carga = b64url(json_encode(['usuario' => $usuario, 'exp' => $expira], JSON_UNESCAPED_UNICODE));
    $firma = b64url(hash_hmac('sha256', $carga, secretoApp(), true));

    return ['token' => "$carga.$firma", 'expira' => $expira];
}

// Devuelve el usuario si el token es válido, o null si no lo es.
function verificarToken(string $token): ?string
{
    $partes = explode('.', $token);
    if (count($partes) !== 2) {
        return null;
    }
    [$carga, $firma] = $partes;

    $esperada = b64url(hash_hmac('sha256', $carga, secretoApp(), true));
    // hash_equals compara en tiempo constante: evita que se pueda adivinar la
    // firma midiendo cuánto tarda en fallar la comparación.
    if (!hash_equals($esperada, $firma)) {
        return null;
    }

    $json = b64urlDecode($carga);
    if ($json === false) {
        return null;
    }
    $datos = json_decode($json, true);
    if (!is_array($datos) || !isset($datos['usuario'], $datos['exp'])) {
        return null;
    }
    if (time() >= (int) $datos['exp']) {
        return null;
    }
    return (string) $datos['usuario'];
}

// Valida las credenciales contra las variables de entorno.
function credencialesValidas(string $usuario, string $password): bool
{
    $usuarioEsperado = (string) env('AUTH_USUARIO', '');
    $hash = (string) env('AUTH_PASSWORD_HASH', '');

    if ($usuarioEsperado === '' || $hash === '') {
        error_log('AUTH_USUARIO o AUTH_PASSWORD_HASH no están definidas.');
        return false;
    }

    // Se verifican ambos SIEMPRE (sin cortocircuito) para que el tiempo de
    // respuesta no revele si el usuario existe o si falló la contraseña.
    $usuarioOk = hash_equals($usuarioEsperado, $usuario);
    $passwordOk = password_verify($password, $hash);

    return $usuarioOk && $passwordOk;
}

// Usuario de la sesión en curso, una vez validado el token.
// Sirve para dejar constancia de quién hizo cada cosa (ver documento-revisar).
function usuarioDeSesion(): ?string
{
    static $usuario = null;
    if (func_num_args() > 0) {
        $usuario = func_get_arg(0);
    }
    return $usuario;
}

// Corta la petición con 401 si no trae un token válido.
function exigirAutenticacion(): void
{
    if (!autenticacionHabilitada()) {
        usuarioDeSesion('desarrollo');
        return;
    }

    $cabecera = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']  // Apache con mod_rewrite
        ?? '';

    $usuario = preg_match('/^Bearer\s+(.+)$/i', trim($cabecera), $m)
        ? verificarToken(trim($m[1]))
        : null;

    if ($usuario === null) {
        http_response_code(401);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(
            ['error' => 'Se requiere iniciar sesión para consultar esta información.'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }

    usuarioDeSesion($usuario);
}

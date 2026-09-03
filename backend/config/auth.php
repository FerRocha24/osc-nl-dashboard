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

// Crea un token con la identidad, el rol y la expiración, firmado con HMAC.
function crearToken(array $persona): array
{
    $horas = (int) (env('AUTH_HORAS_VIGENCIA', '12') ?: 12);
    $expira = time() + $horas * 3600;

    $carga = b64url(json_encode([
        'id'      => $persona['id'],
        'usuario' => $persona['usuario'],
        'rol'     => $persona['rol'],
        'exp'     => $expira,
    ], JSON_UNESCAPED_UNICODE));
    $firma = b64url(hash_hmac('sha256', $carga, secretoApp(), true));

    return ['token' => "$carga.$firma", 'expira' => $expira];
}

// Devuelve la carga del token si es válido, o null si no lo es.
function verificarToken(string $token): ?array
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
    return $datos;
}

/**
 * Valida credenciales y devuelve los datos de la persona, o null.
 *
 * Busca primero en la tabla Usuario. Si TODAVÍA no hay ningún usuario, cae a
 * las variables de entorno: es el modo de arranque, para poder entrar y crear
 * la primera cuenta sin quedarse fuera del sistema. En cuanto existe un
 * usuario en la base, ese respaldo deja de funcionar solo.
 */
function autenticar(PDO $pdo, string $usuario, string $password): ?array
{
    $stmt = $pdo->prepare(
        'SELECT id_usuario, usuario, nombre, password_hash, rol, activo, debe_cambiar_password
         FROM Usuario WHERE usuario = :usuario'
    );
    $stmt->bindValue(':usuario', $usuario);
    $stmt->execute();
    $fila = $stmt->fetch();

    if ($fila) {
        // Se verifica la contraseña ANTES de mirar si la cuenta está activa,
        // para que el tiempo de respuesta no delate cuáles cuentas existen.
        $passwordOk = password_verify($password, $fila['password_hash']);
        if (!$passwordOk || !$fila['activo']) {
            return null;
        }

        $pdo->prepare('UPDATE Usuario SET ultimo_acceso = NOW() WHERE id_usuario = :id')
            ->execute([':id' => $fila['id_usuario']]);

        return [
            'id'                    => (int) $fila['id_usuario'],
            'usuario'               => $fila['usuario'],
            'nombre'                => $fila['nombre'],
            'rol'                   => $fila['rol'],
            'debe_cambiar_password' => (bool) $fila['debe_cambiar_password'],
        ];
    }

    // Modo de arranque: solo mientras la tabla esté vacía.
    if ((int) $pdo->query('SELECT COUNT(*) FROM Usuario')->fetchColumn() > 0) {
        // Se gasta tiempo comparando de todas formas, para no revelar por
        // velocidad que el usuario no existe.
        password_verify($password, '$2y$12$' . str_repeat('.', 53));
        return null;
    }

    $usuarioEsperado = (string) env('AUTH_USUARIO', '');
    $hash = (string) env('AUTH_PASSWORD_HASH', '');
    if ($usuarioEsperado === '' || $hash === '') {
        error_log('No hay usuarios en la base y AUTH_USUARIO/AUTH_PASSWORD_HASH no están definidas.');
        return null;
    }

    $usuarioOk  = hash_equals($usuarioEsperado, $usuario);
    $passwordOk = password_verify($password, $hash);
    if (!$usuarioOk || !$passwordOk) {
        return null;
    }

    return [
        'id'                    => null,
        'usuario'               => $usuarioEsperado,
        'nombre'                => 'Administrador inicial',
        'rol'                   => 'admin',
        'debe_cambiar_password' => false,
        'arranque'              => true,
    ];
}

// Identidad de la sesión en curso, una vez validado el token.
// Devuelve ['id','usuario','nombre','rol'] o null si no hay sesión.
function sesionActual(?array $identidad = null): ?array
{
    static $actual = null;
    if ($identidad !== null) {
        $actual = $identidad;
    }
    return $actual;
}

// Atajo para la auditoría: el nombre a mostrar de quien hizo la acción.
function usuarioDeSesion(): ?string
{
    $s = sesionActual();
    return $s['nombre'] ?? $s['usuario'] ?? null;
}

// Corta la petición con 401 si no trae un token válido.
function exigirAutenticacion(): void
{
    if (!autenticacionHabilitada()) {
        sesionActual(['id' => null, 'usuario' => 'desarrollo',
                      'nombre' => 'Modo desarrollo', 'rol' => 'admin']);
        return;
    }

    $cabecera = $_SERVER['HTTP_AUTHORIZATION']
        ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION']  // Apache con mod_rewrite
        ?? '';

    $carga = preg_match('/^Bearer\s+(.+)$/i', trim($cabecera), $m)
        ? verificarToken(trim($m[1]))
        : null;

    if ($carga === null) {
        rechazar401('Se requiere iniciar sesión para consultar esta información.');
    }

    // El token es autocontenido, así que seguiría siendo válido aunque la
    // cuenta se desactive. Se comprueba contra la base en cada petición para
    // que desactivar a alguien surta efecto de inmediato y no en 12 horas.
    if ($carga['id'] !== null) {
        global $pdo;
        $stmt = $pdo->prepare(
            'SELECT id_usuario, usuario, nombre, rol, activo FROM Usuario WHERE id_usuario = :id'
        );
        $stmt->bindValue(':id', (int) $carga['id'], PDO::PARAM_INT);
        $stmt->execute();
        $fila = $stmt->fetch();

        if (!$fila || !$fila['activo']) {
            rechazar401('Tu cuenta ya no está activa. Contacta al administrador.');
        }

        // Se toman el rol y el nombre de la base, no del token: si a alguien
        // se le cambia el rol, el cambio aplica sin esperar a que expire.
        sesionActual([
            'id'      => (int) $fila['id_usuario'],
            'usuario' => $fila['usuario'],
            'nombre'  => $fila['nombre'],
            'rol'     => $fila['rol'],
        ]);
        return;
    }

    // Sesión del modo de arranque (sin fila en la base).
    sesionActual([
        'id' => null, 'usuario' => $carga['usuario'],
        'nombre' => 'Administrador inicial', 'rol' => $carga['rol'] ?? 'admin',
    ]);
}

function rechazar401(string $mensaje): never
{
    http_response_code(401);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['error' => $mensaje], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Corta con 403 si la sesión no tiene alguno de los roles indicados.
 *
 * 403 y no 401 a propósito: la persona sí está identificada, simplemente no
 * le corresponde esa acción. Un 401 la mandaría a iniciar sesión de nuevo sin
 * resolver nada.
 */
function exigirRol(string ...$roles): void
{
    $rol = sesionActual()['rol'] ?? null;
    if ($rol === null || !in_array($rol, $roles, true)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(
            ['error' => 'Tu cuenta no tiene permiso para realizar esta acción.'],
            JSON_UNESCAPED_UNICODE
        );
        exit;
    }
}

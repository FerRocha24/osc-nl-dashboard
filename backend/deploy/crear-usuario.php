<?php
// Crea o actualiza un usuario del tablero. Se corre en el servidor:
//
//   php backend/deploy/crear-usuario.php
//
// Pregunta la contraseña sin mostrarla en pantalla y no la deja en el
// historial de comandos. Es la forma de crear la primera cuenta cuando la
// tabla Usuario está vacía.

if (PHP_SAPI !== 'cli') {
    exit("Este script solo se ejecuta desde la línea de comandos.\n");
}

require_once __DIR__ . '/../config/database.php';

function preguntar(string $texto, bool $oculto = false): string
{
    echo $texto;
    if (!$oculto) {
        return trim((string) fgets(STDIN));
    }
    // Apaga el eco de la terminal para que la contraseña no se vea.
    shell_exec('stty -echo');
    $valor = trim((string) fgets(STDIN));
    shell_exec('stty echo');
    echo "\n";
    return $valor;
}

$usuario = preguntar('Usuario (para iniciar sesión): ');
if ($usuario === '') { exit("El usuario no puede estar vacío.\n"); }

$nombre = preguntar('Nombre completo (aparece en la auditoría): ');
if ($nombre === '') { exit("El nombre no puede estar vacío.\n"); }

$correo = preguntar('Correo (opcional): ');

echo "Rol [admin / revisor / consulta]: ";
$rol = trim((string) fgets(STDIN));
if (!in_array($rol, ['admin', 'revisor', 'consulta'], true)) {
    exit("Rol inválido.\n");
}

$password = preguntar('Contraseña: ', true);
if (strlen($password) < 8) { exit("La contraseña debe tener al menos 8 caracteres.\n"); }
if ($password !== preguntar('Repite la contraseña: ', true)) {
    exit("Las contraseñas no coinciden.\n");
}

$hash = password_hash($password, PASSWORD_BCRYPT);

// ON DUPLICATE KEY permite usar el mismo script para restablecer la
// contraseña de alguien que la olvidó.
$stmt = $pdo->prepare(
    'INSERT INTO Usuario (usuario, nombre, correo, password_hash, rol, debe_cambiar_password)
     VALUES (:usuario, :nombre, :correo, :hash, :rol, TRUE)
     ON DUPLICATE KEY UPDATE
        nombre = VALUES(nombre), correo = VALUES(correo),
        password_hash = VALUES(password_hash), rol = VALUES(rol),
        activo = TRUE, debe_cambiar_password = TRUE'
);
$stmt->execute([
    ':usuario' => $usuario, ':nombre' => $nombre,
    ':correo' => $correo !== '' ? $correo : null,
    ':hash' => $hash, ':rol' => $rol,
]);

echo "\nListo: $usuario ($rol).\n";
echo "Se le pedirá cambiar la contraseña en su primer ingreso.\n";

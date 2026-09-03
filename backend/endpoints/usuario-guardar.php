<?php
// POST /endpoints/usuario-guardar.php
//   crear:     { usuario, nombre, correo?, rol, password }
//   modificar: { id, nombre?, correo?, rol?, activo?, password? }
//
// Alta y edición de cuentas. Solo administradores.

require_once __DIR__ . '/../config/api.php';

const ROLES = ['admin', 'revisor', 'consulta'];
const LARGO_MINIMO_PASSWORD = 8;

ejecutar(function () use ($pdo) {
    $c = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($c)) {
        responderError('Cuerpo de la petición inválido.', 422);
    }

    $id       = isset($c['id']) ? (string) $c['id'] : '';
    $nombre   = trim((string) ($c['nombre'] ?? ''));
    $correo   = trim((string) ($c['correo'] ?? ''));
    $rol      = (string) ($c['rol'] ?? '');
    $password = (string) ($c['password'] ?? '');
    $sesion   = sesionActual();

    if ($rol !== '' && !in_array($rol, ROLES, true)) {
        responderError('El rol debe ser admin, revisor o consulta.', 422);
    }
    if ($password !== '' && strlen($password) < LARGO_MINIMO_PASSWORD) {
        responderError('La contraseña debe tener al menos ' . LARGO_MINIMO_PASSWORD . ' caracteres.', 422);
    }
    if ($correo !== '' && !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
        responderError('El correo no tiene un formato válido.', 422);
    }

    // ---- Alta ----
    if ($id === '') {
        $usuario = trim((string) ($c['usuario'] ?? ''));
        if (!preg_match('/^[a-zA-Z0-9._-]{3,50}$/', $usuario)) {
            responderError('El usuario debe tener entre 3 y 50 caracteres: letras, números, punto, guion o guion bajo.', 422);
        }
        if ($nombre === '') {
            responderError('El nombre es obligatorio: es lo que aparece en la auditoría.', 422);
        }
        if ($rol === '' || $password === '') {
            responderError('Faltan el rol o la contraseña.', 422);
        }

        $existe = $pdo->prepare('SELECT 1 FROM Usuario WHERE usuario = :u');
        $existe->execute([':u' => $usuario]);
        if ($existe->fetchColumn()) {
            responderError('Ya existe una cuenta con ese usuario.', 409);
        }

        $stmt = $pdo->prepare(
            'INSERT INTO Usuario (usuario, nombre, correo, password_hash, rol, debe_cambiar_password)
             VALUES (:u, :n, :c, :h, :r, TRUE)'
        );
        $stmt->execute([
            ':u' => $usuario, ':n' => $nombre,
            ':c' => $correo !== '' ? $correo : null,
            ':h' => password_hash($password, PASSWORD_BCRYPT), ':r' => $rol,
        ]);

        return ['id_usuario' => (int) $pdo->lastInsertId(), 'creado' => true];
    }

    // ---- Edición ----
    if (!preg_match('/^\d+$/', $id)) {
        responderError('Identificador de usuario inválido.', 422);
    }
    $id = (int) $id;

    $actual = $pdo->prepare('SELECT rol, activo FROM Usuario WHERE id_usuario = :id');
    $actual->execute([':id' => $id]);
    $antes = $actual->fetch();
    if (!$antes) {
        responderError('No existe una cuenta con ese identificador.', 404);
    }

    $esUnoMismo = $sesion['id'] === $id;
    $seDesactiva = array_key_exists('activo', $c) && !$c['activo'];
    $pierdeAdmin = $rol !== '' && $rol !== 'admin' && $antes['rol'] === 'admin';

    // Sin esta guarda, un administrador podría quitarse el rol o desactivarse
    // y dejar el sistema sin nadie que pueda administrarlo.
    if ($esUnoMismo && ($seDesactiva || $pierdeAdmin)) {
        responderError('No puedes quitarte a ti mismo el acceso de administrador.', 422);
    }

    // Y tampoco puede quedar el sistema sin ningún administrador activo.
    if (($seDesactiva || $pierdeAdmin) && $antes['rol'] === 'admin') {
        $otros = (int) $pdo->query(
            "SELECT COUNT(*) FROM Usuario WHERE rol = 'admin' AND activo = TRUE"
        )->fetchColumn();
        if ($otros <= 1) {
            responderError('Debe quedar al menos un administrador activo.', 422);
        }
    }

    $campos = [];
    $params = [':id' => $id];
    if ($nombre !== '')                  { $campos[] = 'nombre = :n';  $params[':n'] = $nombre; }
    if (array_key_exists('correo', $c))  { $campos[] = 'correo = :c';  $params[':c'] = $correo !== '' ? $correo : null; }
    if ($rol !== '')                     { $campos[] = 'rol = :r';     $params[':r'] = $rol; }
    if (array_key_exists('activo', $c))  { $campos[] = 'activo = :a';  $params[':a'] = $c['activo'] ? 1 : 0; }
    if ($password !== '') {
        $campos[] = 'password_hash = :h';
        $campos[] = 'debe_cambiar_password = TRUE';
        $params[':h'] = password_hash($password, PASSWORD_BCRYPT);
    }

    if ($campos === []) {
        responderError('No se indicó ningún cambio.', 422);
    }

    $pdo->prepare('UPDATE Usuario SET ' . implode(', ', $campos) . ' WHERE id_usuario = :id')
        ->execute($params);

    return ['id_usuario' => $id, 'actualizado' => true];
}, ['POST'], roles: ['admin']);

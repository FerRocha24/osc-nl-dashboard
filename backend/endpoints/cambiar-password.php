<?php
// POST /endpoints/cambiar-password.php   { actual, nueva }
//
// Cada quien cambia su propia contraseña. No necesita ser administrador, pero
// sí demostrar que conoce la actual: sin eso, cualquiera que encontrara una
// sesión abierta podría dejar a su dueño fuera de su propia cuenta.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $c = json_decode(file_get_contents('php://input') ?: '', true);
    $actual = is_array($c) ? (string) ($c['actual'] ?? '') : '';
    $nueva  = is_array($c) ? (string) ($c['nueva'] ?? '') : '';

    if ($actual === '' || $nueva === '') {
        responderError('Faltan la contraseña actual o la nueva.', 422);
    }
    if (strlen($nueva) < 8) {
        responderError('La contraseña nueva debe tener al menos 8 caracteres.', 422);
    }
    if ($nueva === $actual) {
        responderError('La contraseña nueva debe ser distinta de la actual.', 422);
    }

    $sesion = sesionActual();
    if ($sesion['id'] === null) {
        responderError(
            'La cuenta inicial no tiene contraseña en la base. Crea tu usuario ' .
            'con el script crear-usuario.php y entra con él.',
            422
        );
    }

    $stmt = $pdo->prepare('SELECT password_hash FROM Usuario WHERE id_usuario = :id');
    $stmt->execute([':id' => $sesion['id']]);
    $hash = (string) $stmt->fetchColumn();

    if (!password_verify($actual, $hash)) {
        usleep(400000);
        responderError('La contraseña actual no es correcta.', 401);
    }

    $pdo->prepare(
        'UPDATE Usuario SET password_hash = :h, debe_cambiar_password = FALSE WHERE id_usuario = :id'
    )->execute([':h' => password_hash($nueva, PASSWORD_BCRYPT), ':id' => $sesion['id']]);

    return ['actualizada' => true];
}, ['POST']);

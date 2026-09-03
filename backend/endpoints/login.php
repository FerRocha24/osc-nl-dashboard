<?php
// POST /endpoints/login.php   { "usuario": "...", "password": "..." }
//
// Único endpoint público. Valida contra la tabla Usuario y devuelve un token
// firmado que el frontend manda después en Authorization: Bearer <token>.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $cuerpo = json_decode(file_get_contents('php://input') ?: '', true);
    $usuario  = is_array($cuerpo) ? trim((string) ($cuerpo['usuario'] ?? '')) : '';
    $password = is_array($cuerpo) ? (string) ($cuerpo['password'] ?? '') : '';

    if ($usuario === '' || $password === '') {
        responderError('Faltan el usuario o la contraseña.', 422);
    }

    $persona = autenticar($pdo, $usuario, $password);

    if ($persona === null) {
        // Mensaje deliberadamente genérico: distinguir "no existe" de
        // "contraseña incorrecta" le confirmaría a quien lo intenta cuáles
        // usuarios son válidos. La pausa encarece la fuerza bruta.
        usleep(400000);
        responderError('Usuario o contraseña incorrectos.', 401);
    }

    $token = crearToken($persona);

    return [
        'token'                 => $token['token'],
        'expira'                => $token['expira'],
        'usuario'               => $persona['usuario'],
        'nombre'                => $persona['nombre'],
        'rol'                   => $persona['rol'],
        'debe_cambiar_password' => $persona['debe_cambiar_password'],
        // Avisa al frontend que todavía no hay usuarios reales en la base.
        'modo_arranque'         => $persona['arranque'] ?? false,
    ];
}, ['POST'], publico: true);

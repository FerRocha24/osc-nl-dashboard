<?php
// POST /endpoints/login.php   { "usuario": "...", "password": "..." }
//
// Único endpoint público. Verifica las credenciales contra las variables de
// entorno y devuelve un token firmado que el frontend manda después en la
// cabecera Authorization: Bearer <token>.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () {
    $cuerpo = json_decode(file_get_contents('php://input') ?: '', true);
    $usuario  = is_array($cuerpo) ? trim((string) ($cuerpo['usuario'] ?? '')) : '';
    $password = is_array($cuerpo) ? (string) ($cuerpo['password'] ?? '') : '';

    if ($usuario === '' || $password === '') {
        responderError('Faltan el usuario o la contraseña.', 422);
    }

    if (!credencialesValidas($usuario, $password)) {
        // Mensaje deliberadamente genérico: decir "el usuario no existe"
        // le confirmaría a quien lo intenta cuáles usuarios sí son válidos.
        // Una pausa corta encarece probar contraseñas por fuerza bruta.
        usleep(400000);
        responderError('Usuario o contraseña incorrectos.', 401);
    }

    $token = crearToken($usuario);

    return [
        'token'   => $token['token'],
        'expira'  => $token['expira'],
        'usuario' => $usuario,
    ];
}, ['POST'], publico: true);

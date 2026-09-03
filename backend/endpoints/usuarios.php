<?php
// GET /endpoints/usuarios.php
// Lista de cuentas del tablero. Solo para administradores: saber quién tiene
// acceso y con qué rol no es información que deba ver cualquiera.
//
// Nunca devuelve password_hash.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $filas = $pdo->query("
        SELECT id_usuario, usuario, nombre, correo, rol, activo,
               debe_cambiar_password, fecha_creacion, ultimo_acceso
        FROM Usuario
        ORDER BY activo DESC, nombre ASC
    ")->fetchAll();

    return ['usuarios' => array_map(static function (array $u): array {
        $u['id_usuario'] = (int) $u['id_usuario'];
        $u['activo'] = (bool) $u['activo'];
        $u['debe_cambiar_password'] = (bool) $u['debe_cambiar_password'];
        return $u;
    }, $filas)];
}, roles: ['admin']);

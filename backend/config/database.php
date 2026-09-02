<?php
// Configuración de conexión a la base de datos MySQL usando PDO.
//
// Las credenciales NO se escriben aquí: se leen de variables de entorno
// (o del archivo .env, ver env.php). Cuando esto migre al servidor real
// del socio formador (RHEL + Apache + PHP), basta con definir DB_HOST,
// DB_USER, DB_PASSWORD y DB_NAME en el entorno de Apache y este archivo
// funciona sin cambios.

require_once __DIR__ . '/env.php';

$host     = env('DB_HOST', 'localhost');
$dbname   = env('DB_NAME', 'osc_nl');
$user     = env('DB_USER', 'admin');
$password = env('DB_PASSWORD', '');

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$dbname;charset=utf8mb4",
        $user,
        $password,
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            // Sin emulación: las consultas preparadas se mandan reales al
            // servidor MySQL, que es lo que de verdad blinda contra inyección
            // SQL y permite enlazar LIMIT/OFFSET como enteros.
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
} catch (PDOException $e) {
    // Al cliente solo se le da un mensaje genérico (no filtrar credenciales
    // ni detalles del servidor); el detalle real va al log de errores.
    error_log('Error de conexión a MySQL: ' . $e->getMessage());
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    die(json_encode(['error' => 'Error de conexión a la base de datos'], JSON_UNESCAPED_UNICODE));
}

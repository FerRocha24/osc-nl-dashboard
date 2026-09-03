<?php
// GET /endpoints/documento-archivo.php?id=5
// Entrega el binario de un documento.
//
// Los archivos NO se sirven por URL directa: viven fuera del DocumentRoot y
// solo salen por aquí, con sesión válida y con el tipo que el servidor detectó
// al subirlos, nunca uno que proponga el cliente.

require_once __DIR__ . '/../config/api.php';
require_once __DIR__ . '/../config/archivos.php';

iniciarApi();
exigirAutenticacion();

$id = $_GET['id'] ?? '';
if (!preg_match('/^\d+$/', (string) $id)) {
    responderError("Falta el parámetro 'id' o no es un número.", 422);
}

try {
    $stmt = $pdo->prepare("
        SELECT nombre_original, nombre_almacenado, tipo_mime, tamano_bytes
        FROM Documentacion WHERE id_documento = :id");
    $stmt->bindValue(':id', (int) $id, PDO::PARAM_INT);
    $stmt->execute();
    $doc = $stmt->fetch();
} catch (PDOException $e) {
    error_log('Error SQL en documento-archivo: ' . $e->getMessage());
    responderError('Error al consultar la base de datos', 500);
}

if (!$doc || !$doc['nombre_almacenado']) {
    responderError('El documento no existe o no tiene archivo adjunto.', 404);
}

$ruta = rutaArchivo($doc['nombre_almacenado']);
if ($ruta === '') {
    error_log("Archivo faltante en disco: documento {$id}");
    responderError('El archivo ya no está disponible en el servidor.', 410);
}

// Se sustituyen las cabeceras JSON que puso iniciarApi().
header('Content-Type: ' . $doc['tipo_mime']);
header('Content-Length: ' . (string) filesize($ruta));

// Impide que el navegador ignore el Content-Type y adivine otro leyendo el
// contenido: sin esto, un archivo con HTML dentro podría ejecutarse como
// página en el dominio de la API.
header('X-Content-Type-Options: nosniff');

// inline para poder verlo en el visor; el nombre va entrecomillado y ya
// vino limpio de saltos de línea al subirse (ver limpiarNombre).
header('Content-Disposition: inline; filename="' . $doc['nombre_original'] . '"');

// Es información de un registro con datos de contacto: que no quede en cachés
// intermedias.
header('Cache-Control: private, no-store');

readfile($ruta);

<?php
// Almacenamiento de los documentos del expediente digital.
//
// Subir archivos es la vía más común a una ejecución remota de código: basta
// que alguien deje un .php dentro de una carpeta que Apache sirva. Todo lo de
// aquí existe para que eso no pueda pasar.
//
// Las cuatro defensas, en orden de importancia:
//
//   1. Los archivos viven FUERA del DocumentRoot. Aunque se colara un .php,
//      Apache no tiene ninguna ruta para ejecutarlo.
//   2. El nombre en disco lo genera el servidor al azar y sin extensión. El
//      nombre del usuario se guarda solo para mostrarlo.
//   3. El tipo se detecta leyendo los bytes del archivo (finfo), no el que
//      declara el navegador, que es texto libre y se falsifica trivialmente.
//   4. Se sirven por un endpoint de PHP que fija el Content-Type y prohíbe
//      que el navegador adivine otro (nosniff).

require_once __DIR__ . '/env.php';

// Solo estos tipos, y comprobados por contenido. SVG queda fuera a propósito:
// es XML, admite <script> dentro y se ejecutaría al abrirlo en el navegador.
const TIPOS_PERMITIDOS = [
    'application/pdf' => 'pdf',
    'image/jpeg'      => 'jpg',
    'image/png'       => 'png',
];

const TAMANO_MAXIMO = 10 * 1024 * 1024;  // 10 MB

/**
 * Carpeta donde viven los archivos. DEBE quedar fuera del DocumentRoot.
 * En el servidor se define con ARCHIVOS_DIR; en local cae a una carpeta
 * hermana de backend/, que tampoco se sirve por HTTP.
 */
function carpetaArchivos(): string
{
    $ruta = env('ARCHIVOS_DIR') ?: dirname(__DIR__, 2) . '/archivos';

    if (!is_dir($ruta) && !@mkdir($ruta, 0750, true) && !is_dir($ruta)) {
        error_log("No se pudo crear la carpeta de archivos: $ruta");
        return '';
    }
    return rtrim($ruta, '/');
}

/**
 * Valida un archivo recién subido y lo guarda.
 * Devuelve los metadatos para la base, o lanza RuntimeException con un mensaje
 * que se le puede mostrar a la persona.
 */
function guardarArchivoSubido(array $archivo): array
{
    if (($archivo['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        throw new RuntimeException(match ($archivo['error'] ?? -1) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'El archivo excede el tamaño permitido.',
            UPLOAD_ERR_PARTIAL   => 'La subida se interrumpió; inténtalo de nuevo.',
            UPLOAD_ERR_NO_FILE   => 'No se recibió ningún archivo.',
            default              => 'No se pudo procesar el archivo.',
        });
    }

    // Confirma que el archivo llegó por HTTP y no es una ruta del servidor que
    // alguien inyectó para que copiemos, por ejemplo, /etc/passwd.
    if (!is_uploaded_file($archivo['tmp_name'])) {
        throw new RuntimeException('Archivo inválido.');
    }

    $tamano = (int) ($archivo['size'] ?? 0);
    if ($tamano <= 0) {
        throw new RuntimeException('El archivo está vacío.');
    }
    if ($tamano > TAMANO_MAXIMO) {
        throw new RuntimeException('El archivo supera los 10 MB permitidos.');
    }

    // El tipo REAL, leído de los bytes. El navegador manda su propio
    // Content-Type pero es un dato del cliente: no se le cree.
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $tipo = $finfo->file($archivo['tmp_name']) ?: '';
    if (!isset(TIPOS_PERMITIDOS[$tipo])) {
        throw new RuntimeException(
            'Solo se aceptan archivos PDF, JPG o PNG. ' .
            'El archivo recibido parece ser de otro tipo.'
        );
    }

    $carpeta = carpetaArchivos();
    if ($carpeta === '') {
        throw new RuntimeException('El servidor no tiene dónde guardar el archivo.');
    }

    // Nombre generado por el servidor. Sin extensión: nada que Apache pueda
    // interpretar aunque la carpeta quedara expuesta por accidente.
    $nombreAlmacenado = bin2hex(random_bytes(24));
    $destino = "$carpeta/$nombreAlmacenado";

    if (!move_uploaded_file($archivo['tmp_name'], $destino)) {
        throw new RuntimeException('No se pudo guardar el archivo.');
    }
    chmod($destino, 0640);

    return [
        'nombre_original'   => limpiarNombre((string) ($archivo['name'] ?? 'documento')),
        'nombre_almacenado' => $nombreAlmacenado,
        'tipo_mime'         => $tipo,
        'tamano_bytes'      => $tamano,
        'hash_sha256'       => hash_file('sha256', $destino),
    ];
}

/**
 * Deja el nombre original en algo seguro de mostrar. No se usa para rutas,
 * pero igual se limpia: va a terminar dentro de HTML y de una cabecera HTTP.
 */
function limpiarNombre(string $nombre): string
{
    $nombre = basename($nombre);                       // corta cualquier ruta
    $nombre = preg_replace('/[\x00-\x1F\x7F]/u', '', $nombre);  // control chars
    $nombre = str_replace(['"', '\\', "\r", "\n"], '', $nombre);
    $nombre = trim($nombre);
    return $nombre === '' ? 'documento' : mb_substr($nombre, 0, 200);
}

// Ruta absoluta de un archivo ya guardado, o '' si no existe.
function rutaArchivo(string $nombreAlmacenado): string
{
    // El nombre viene de la base, pero se valida igual: si algún día se
    // corrompiera esa columna, esto evita salir de la carpeta.
    if (!preg_match('/^[0-9a-f]{48}$/', $nombreAlmacenado)) {
        return '';
    }
    $ruta = carpetaArchivos() . '/' . $nombreAlmacenado;
    return is_file($ruta) ? $ruta : '';
}

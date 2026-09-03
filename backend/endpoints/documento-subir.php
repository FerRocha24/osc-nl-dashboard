<?php
// POST /endpoints/documento-subir.php   (multipart/form-data)
//   campos: osc, tipo_documento, archivo
//
// Sube un documento al expediente de una OSC. Queda en 'Pendiente' hasta que
// alguien lo revise: subir no es aprobar.

require_once __DIR__ . '/../config/api.php';
require_once __DIR__ . '/../config/archivos.php';

ejecutar(function () use ($pdo) {
    $osc  = trim((string) ($_POST['osc'] ?? ''));
    $tipo = trim((string) ($_POST['tipo_documento'] ?? ''));

    if (!preg_match('/^\d+$/', $osc)) {
        responderError('Falta indicar a qué organización pertenece el documento.', 422);
    }
    if ($tipo === '') {
        responderError('Falta el tipo de documento.', 422);
    }
    if (mb_strlen($tipo) > 100) {
        responderError('El tipo de documento es demasiado largo.', 422);
    }

    // Se confirma que la OSC existe antes de guardar nada en disco: si no,
    // quedaría un archivo huérfano que nadie borra.
    $stmt = $pdo->prepare('SELECT 1 FROM OSC WHERE id_osc = :osc');
    $stmt->bindValue(':osc', (int) $osc, PDO::PARAM_INT);
    $stmt->execute();
    if (!$stmt->fetchColumn()) {
        responderError('No existe una organización con ese identificador.', 404);
    }

    try {
        $meta = guardarArchivoSubido($_FILES['archivo'] ?? []);
    } catch (RuntimeException $e) {
        responderError($e->getMessage(), 422);
    }

    try {
        $stmt = $pdo->prepare("
            INSERT INTO Documentacion
                (id_osc, tipo_documento, nombre_original, nombre_almacenado,
                 tipo_mime, tamano_bytes, hash_sha256,
                 estatus_validacion, fecha_entrega, fecha_subida)
            VALUES
                (:osc, :tipo, :nombre, :almacenado,
                 :mime, :tamano, :hash,
                 'Pendiente', CURDATE(), NOW())");
        $stmt->bindValue(':osc', (int) $osc, PDO::PARAM_INT);
        $stmt->bindValue(':tipo', $tipo);
        $stmt->bindValue(':nombre', $meta['nombre_original']);
        $stmt->bindValue(':almacenado', $meta['nombre_almacenado']);
        $stmt->bindValue(':mime', $meta['tipo_mime']);
        $stmt->bindValue(':tamano', $meta['tamano_bytes'], PDO::PARAM_INT);
        $stmt->bindValue(':hash', $meta['hash_sha256']);
        $stmt->execute();
    } catch (PDOException $e) {
        // Si la base falla después de mover el archivo, se borra: guardar un
        // binario sin registro que lo referencie es basura permanente.
        $ruta = rutaArchivo($meta['nombre_almacenado']);
        if ($ruta !== '') {
            @unlink($ruta);
        }
        throw $e;
    }

    return [
        'id_documento'   => (int) $pdo->lastInsertId(),
        'nombre_original'=> $meta['nombre_original'],
        'tipo_mime'      => $meta['tipo_mime'],
        'tamano_bytes'   => $meta['tamano_bytes'],
        'estatus'        => 'Pendiente',
    ];
}, ['POST']);

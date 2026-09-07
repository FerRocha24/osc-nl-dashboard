<?php
// POST /endpoints/osc-ubicacion-fisica.php   { id, ubicacion }
//
// Dónde está el expediente en papel de una organización.
//
// Texto libre: cada oficina numera sus archiveros a su manera, y un catálogo
// cerrado obligaría a inventar una nomenclatura que nadie usa. Un campo que no
// se puede llenar como uno habla se queda vacío.
//
// Cadena vacía lo borra, para corregir una referencia que dejó de ser cierta
// —el expediente se movió de archivero— sin dejar una pista falsa.

require_once __DIR__ . '/../config/api.php';

const LARGO_MAXIMO_UBICACION = 255;

ejecutar(function () use ($pdo) {
    $cuerpo = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($cuerpo)) {
        responderError('Cuerpo de la petición inválido.', 422);
    }

    $id = (string) ($cuerpo['id'] ?? '');
    if (!preg_match('/^\d+$/', $id)) {
        responderError('Falta el identificador de la organización.', 422);
    }

    $ubicacion = trim((string) ($cuerpo['ubicacion'] ?? ''));
    // Se mide en caracteres y no en bytes: con mb_strlen, una referencia con
    // acentos no se rechaza antes de tiempo por ocupar más bytes.
    if (mb_strlen($ubicacion) > LARGO_MAXIMO_UBICACION) {
        responderError(
            'La ubicación es demasiado larga (máximo ' . LARGO_MAXIMO_UBICACION
            . ' caracteres). Si necesitas explicar más, va en las observaciones.',
            422
        );
    }

    $stmt = $pdo->prepare('UPDATE OSC SET ubicacion_fisica = :u WHERE id_osc = :id');
    $stmt->bindValue(':u', $ubicacion === '' ? null : $ubicacion,
                     $ubicacion === '' ? PDO::PARAM_NULL : PDO::PARAM_STR);
    $stmt->bindValue(':id', (int) $id, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        $existe = $pdo->prepare('SELECT 1 FROM OSC WHERE id_osc = :id');
        $existe->bindValue(':id', (int) $id, PDO::PARAM_INT);
        $existe->execute();
        if (!$existe->fetchColumn()) {
            responderError('No existe una organización con ese identificador.', 404);
        }
    }

    return ['id_osc' => (int) $id, 'ubicacion_fisica' => $ubicacion === '' ? null : $ubicacion];
}, ['POST'], roles: ['admin', 'revisor']);

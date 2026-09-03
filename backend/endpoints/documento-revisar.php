<?php
// POST /endpoints/documento-revisar.php   { id, decision, motivo? }
//   decision: "aprobar" | "rechazar" | "vencido"
//
// Registra el resultado de la revisión de un documento y deja constancia de
// quién decidió y cuándo.

require_once __DIR__ . '/../config/api.php';

const DECISIONES = [
    'aprobar'  => 'Completo',
    'rechazar' => 'Rechazado',
    'vencido'  => 'Vencido',
];

ejecutar(function () use ($pdo) {
    $cuerpo = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($cuerpo)) {
        responderError('Cuerpo de la petición inválido.', 422);
    }

    $id       = (string) ($cuerpo['id'] ?? '');
    $decision = (string) ($cuerpo['decision'] ?? '');
    $motivo   = trim((string) ($cuerpo['motivo'] ?? ''));

    if (!preg_match('/^\d+$/', $id)) {
        responderError('Falta el identificador del documento.', 422);
    }
    if (!isset(DECISIONES[$decision])) {
        responderError('La decisión debe ser aprobar, rechazar o vencido.', 422);
    }
    // Rechazar sin explicar deja a la organización sin saber qué corregir.
    if ($decision === 'rechazar' && $motivo === '') {
        responderError('Para rechazar un documento hay que indicar el motivo.', 422);
    }
    if (mb_strlen($motivo) > 1000) {
        responderError('El motivo es demasiado largo (máximo 1000 caracteres).', 422);
    }

    $stmt = $pdo->prepare("
        UPDATE Documentacion
        SET estatus_validacion = :estatus,
            motivo_rechazo     = :motivo,
            revisado_por       = :revisor,
            revisado_por_id    = :revisor_id,
            fecha_revision     = NOW()
        WHERE id_documento = :id");
    $stmt->bindValue(':estatus', DECISIONES[$decision]);
    // El motivo solo tiene sentido en un rechazo; al aprobar se limpia para
    // que no quede colgando el de un rechazo anterior.
    $stmt->bindValue(':motivo', $decision === 'rechazar' ? $motivo : null,
                     $decision === 'rechazar' ? PDO::PARAM_STR : PDO::PARAM_NULL);
    // Se guardan las dos cosas: el id para poder enlazar a la cuenta, y el
    // nombre tal como estaba al revisar, para que el histórico siga siendo
    // legible aunque después cambie o se desactive la cuenta.
    $sesion = sesionActual();
    $stmt->bindValue(':revisor', $sesion['nombre'] ?? 'desconocido');
    $stmt->bindValue(':revisor_id', $sesion['id'], $sesion['id'] === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    $stmt->bindValue(':id', (int) $id, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        // Puede ser que no exista, o que ya tuviera exactamente ese estatus.
        $existe = $pdo->prepare('SELECT 1 FROM Documentacion WHERE id_documento = :id');
        $existe->bindValue(':id', (int) $id, PDO::PARAM_INT);
        $existe->execute();
        if (!$existe->fetchColumn()) {
            responderError('No existe un documento con ese identificador.', 404);
        }
    }

    return ['id_documento' => (int) $id, 'estatus' => DECISIONES[$decision]];
}, ['POST'], roles: ['admin', 'revisor']);

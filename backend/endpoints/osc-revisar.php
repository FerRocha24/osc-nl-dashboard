<?php
// POST /endpoints/osc-revisar.php   { id, decision, motivo? }
//   decision: "aceptar" | "denegar" | "reabrir"
//
// Resolución del Registro sobre una organización completa. Es distinta de la
// revisión documento por documento: no existe una lista cerrada de qué
// documentos debe entregar cada OSC, así que ningún cálculo puede concluir
// "ya está completa". La firma una persona; los documentos son la evidencia.

require_once __DIR__ . '/../config/api.php';

const RESOLUCIONES = [
    'aceptar' => 'Aceptada',
    'denegar' => 'Denegada',
    // Devuelve la OSC a la bandeja. Sirve para deshacer un error y para
    // reabrir un caso cuando la organización entrega lo que le faltaba.
    'reabrir' => 'Pendiente',
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
        responderError('Falta el identificador de la organización.', 422);
    }
    if (!isset(RESOLUCIONES[$decision])) {
        responderError('La decisión debe ser aceptar, denegar o reabrir.', 422);
    }
    // Denegar sin explicar deja a la organización sin saber qué corregir, y a
    // quien revise después sin saber por qué se decidió así.
    if ($decision === 'denegar' && $motivo === '') {
        responderError('Para denegar una organización hay que indicar el motivo.', 422);
    }
    if (mb_strlen($motivo) > 1000) {
        responderError('El motivo es demasiado largo (máximo 1000 caracteres).', 422);
    }

    $estatus = RESOLUCIONES[$decision];
    // El motivo se conserva solo al denegar: al aceptar o reabrir se limpia
    // para que no quede colgando el de una decisión anterior ya revertida.
    $guardaMotivo = $decision === 'denegar';
    // Reabrir es volver al estado inicial, así que también se borra la firma:
    // dejarla haría ver una resolución que ya no existe.
    $conservaFirma = $decision !== 'reabrir';

    $sesion = sesionActual();

    $stmt = $pdo->prepare("
        UPDATE OSC
        SET estatus_revision = :estatus,
            motivo_revision  = :motivo,
            fecha_revision   = :fecha,
            revisado_por     = :revisor,
            revisado_por_id  = :revisor_id
        WHERE id_osc = :id");
    $stmt->bindValue(':estatus', $estatus);
    $stmt->bindValue(':motivo', $guardaMotivo ? $motivo : null,
                     $guardaMotivo ? PDO::PARAM_STR : PDO::PARAM_NULL);

    if ($conservaFirma) {
        $stmt->bindValue(':fecha', date('Y-m-d H:i:s'));
        // Se guarda el nombre además del id: así el histórico sigue siendo
        // legible si la cuenta se renombra o se desactiva, y cubre al
        // administrador de arranque, que todavía no tiene fila en Usuario.
        $stmt->bindValue(':revisor', $sesion['nombre'] ?? 'desconocido');
        $stmt->bindValue(':revisor_id', $sesion['id'],
                         $sesion['id'] === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
    } else {
        $stmt->bindValue(':fecha', null, PDO::PARAM_NULL);
        $stmt->bindValue(':revisor', null, PDO::PARAM_NULL);
        $stmt->bindValue(':revisor_id', null, PDO::PARAM_NULL);
    }

    $stmt->bindValue(':id', (int) $id, PDO::PARAM_INT);
    $stmt->execute();

    if ($stmt->rowCount() === 0) {
        // Puede no existir, o ya estar exactamente en esa resolución.
        $existe = $pdo->prepare('SELECT 1 FROM OSC WHERE id_osc = :id');
        $existe->bindValue(':id', (int) $id, PDO::PARAM_INT);
        $existe->execute();
        if (!$existe->fetchColumn()) {
            responderError('No existe una organización con ese identificador.', 404);
        }
    }

    registrarBitacora($pdo, 'osc.' . $decision, [
        'id_osc'  => (int) $id,
        'detalle' => $decision === 'denegar' ? "Motivo: $motivo" : null,
    ]);

    return [
        'id_osc'           => (int) $id,
        'estatus_revision' => $estatus,
    ];
}, ['POST'], roles: ['admin', 'revisor']);

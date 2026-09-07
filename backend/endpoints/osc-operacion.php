<?php
// POST /endpoints/osc-operacion.php
//   { id, estatus, observaciones?, fecha_visita?, nota_visita? }
//
// Actualiza a mano el estatus de operación de una OSC y lo que lo sustenta:
// las observaciones y la última visita.
//
// OJO con la precedencia: este campo también viene del CSV de la Secretaría, y
// la importación sobrescribe cualquier columna que el archivo traiga con
// valor. O sea, el archivo gana sobre lo que se capture aquí. Es una decisión
// tomada a propósito —su Excel es la fuente de verdad del padrón—, y por eso
// la pantalla lo advierte en vez de dejar que el cambio desaparezca callado.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $cuerpo = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($cuerpo)) {
        responderError('Cuerpo de la petición inválido.', 422);
    }

    $id = (string) ($cuerpo['id'] ?? '');
    if (!preg_match('/^\d+$/', $id)) {
        responderError('Falta el identificador de la organización.', 422);
    }

    // Cadena vacía = "Sin dato". Sirve para deshacer una captura equivocada y
    // dejar la OSC como estaba antes de que alguien la tocara.
    $estatus = trim((string) ($cuerpo['estatus'] ?? ''));
    if ($estatus !== '' && !in_array($estatus, ESTATUS_OPERACION, true)) {
        responderError("El estatus de operación no es un valor válido del padrón.", 422);
    }

    $observaciones = trim((string) ($cuerpo['observaciones'] ?? ''));
    $notaVisita    = trim((string) ($cuerpo['nota_visita'] ?? ''));
    foreach (['observaciones' => $observaciones, 'nota de la visita' => $notaVisita] as $etiqueta => $texto) {
        if (mb_strlen($texto) > 2000) {
            responderError("El texto de $etiqueta es demasiado largo (máximo 2000 caracteres).", 422);
        }
    }

    $fechaVisita = trim((string) ($cuerpo['fecha_visita'] ?? ''));
    if ($fechaVisita !== '') {
        $d = DateTime::createFromFormat('Y-m-d', $fechaVisita);
        // getLastErrors detecta fechas imposibles que el formato sí acepta,
        // como 2026-02-31.
        if (!$d || $d->format('Y-m-d') !== $fechaVisita) {
            responderError('La fecha de la visita debe tener el formato AAAA-MM-DD.', 422);
        }
        if ($d > new DateTime('today')) {
            responderError('La fecha de la visita no puede ser futura.', 422);
        }
    }

    $stmt = $pdo->prepare("
        UPDATE OSC
        SET estatus_operacion                 = :estatus,
            observaciones_estatus             = :observaciones,
            fecha_actualizacion_observaciones = :hoy,
            ultima_fecha_visita               = :fecha_visita,
            ultima_visita_observacion         = :nota_visita
        WHERE id_osc = :id");

    $nulo = static fn(string $v) => $v === '' ? null : $v;
    $stmt->bindValue(':estatus', $nulo($estatus), $estatus === '' ? PDO::PARAM_NULL : PDO::PARAM_STR);
    $stmt->bindValue(':observaciones', $nulo($observaciones),
                     $observaciones === '' ? PDO::PARAM_NULL : PDO::PARAM_STR);
    // Es la misma columna que trae el archivo (FechaActualizacionObservaciones):
    // deja constancia de cuándo se capturó la observación. Se estampa solo si
    // hay observación: al vaciar el campo, una fecha suelta diría que alguien
    // escribió algo que ya no está.
    $stmt->bindValue(':hoy', $observaciones === '' ? null : date('Y-m-d'),
                     $observaciones === '' ? PDO::PARAM_NULL : PDO::PARAM_STR);
    $stmt->bindValue(':fecha_visita', $nulo($fechaVisita),
                     $fechaVisita === '' ? PDO::PARAM_NULL : PDO::PARAM_STR);
    $stmt->bindValue(':nota_visita', $nulo($notaVisita),
                     $notaVisita === '' ? PDO::PARAM_NULL : PDO::PARAM_STR);
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

    return ['id_osc' => (int) $id, 'estatus_operacion' => $nulo($estatus)];
}, ['POST'], roles: ['admin', 'revisor']);

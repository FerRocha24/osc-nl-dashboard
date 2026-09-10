<?php
// POST /endpoints/osc-asignar.php
//   { id: 12, usuario_id: 3 }              asigna una organización
//   { filtros: {...}, usuario_id: 3 }      asigna TODAS las que cumplan el filtro
//
// usuario_id null quita la asignación.
//
// El modo por lote existe porque repartir el padrón inicial de una en una son
// 779 clics. Devuelve cuántas afectaría antes de tocar nada si no se confirma,
// por la misma razón que la importación: una operación masiva que no se puede
// revisar antes es una que se ejecuta a ciegas.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $cuerpo = json_decode(file_get_contents('php://input') ?: '', true);
    if (!is_array($cuerpo)) {
        responderError('Cuerpo de la petición inválido.', 422);
    }

    // ---- A quién se asigna --------------------------------------------------
    $usuarioId = $cuerpo['usuario_id'] ?? null;
    $cuenta = null;
    if ($usuarioId !== null) {
        if (!is_int($usuarioId) && !preg_match('/^\d+$/', (string) $usuarioId)) {
            responderError('El identificador de la cuenta no es válido.', 422);
        }
        $usuarioId = (int) $usuarioId;

        // Se valida el rol aquí y no solo en la pantalla: asignarle trabajo a
        // una cuenta de consulta le daría una bandeja que no puede atender,
        // porque no puede aprobar ni denegar nada.
        $stmt = $pdo->prepare("SELECT nombre, rol, activo FROM Usuario WHERE id_usuario = :id");
        $stmt->bindValue(':id', $usuarioId, PDO::PARAM_INT);
        $stmt->execute();
        $cuenta = $stmt->fetch();

        if (!$cuenta) {
            responderError('No existe una cuenta con ese identificador.', 404);
        }
        if (!$cuenta['activo']) {
            responderError('Esa cuenta está desactivada; no se le puede asignar trabajo.', 422);
        }
        if (!in_array($cuenta['rol'], ['admin', 'revisor'], true)) {
            responderError('Solo se puede asignar a cuentas de administrador o revisor.', 422);
        }
    }

    $fecha = $usuarioId === null ? null : date('Y-m-d H:i:s');

    // ---- Modo individual ----------------------------------------------------
    if (isset($cuerpo['id'])) {
        $id = (string) $cuerpo['id'];
        if (!preg_match('/^\d+$/', $id)) {
            responderError('Falta el identificador de la organización.', 422);
        }

        $stmt = $pdo->prepare("
            UPDATE OSC SET asignado_a_id = :usuario, fecha_asignacion = :fecha
            WHERE id_osc = :id");
        $stmt->bindValue(':usuario', $usuarioId, $usuarioId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':fecha', $fecha, $fecha === null ? PDO::PARAM_NULL : PDO::PARAM_STR);
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

        // El nombre de a quién se asignó se guarda en el detalle, no solo el
        // id: dentro de un año, "asignó a la cuenta 7" no le dice nada a nadie.
        registrarBitacora($pdo, $usuarioId === null ? 'osc.desasignar' : 'osc.asignar', [
            'id_osc'  => (int) $id,
            'detalle' => $usuarioId === null ? null : 'Asignada a ' . ($cuenta['nombre'] ?? "cuenta $usuarioId"),
        ]);

        return ['asignadas' => 1, 'usuario_id' => $usuarioId];
    }

    // ---- Modo por lote ------------------------------------------------------
    // Se reusan exactamente los mismos filtros de la tabla del padrón, para que
    // "lo que asigno" sea sin ambigüedad "lo que estoy viendo".
    [$where, $having, $params] = filtrosPadron($cuerpo['filtros'] ?? []);

    // Se agrupa siempre, aunque no haya filtro de expediente: el estatus
    // documental es un agregado sobre Documentacion, y el HAVING lo necesita.
    $estatusDoc = SQL_ESTATUS_DOCUMENTAL;
    $sqlIds = "
        SELECT o.id_osc, $estatusDoc AS estatus_documental
        FROM OSC o
        LEFT JOIN Municipio     m ON m.id_municipio = o.id_municipio
        LEFT JOIN Documentacion d ON d.id_osc = o.id_osc
        $where
        GROUP BY o.id_osc
        $having";

    $stmt = $pdo->prepare($sqlIds);
    $stmt->execute($params);
    $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);  // la primera columna es id_osc

    // Sin confirmar solo se informa. La cifra es lo que permite darse cuenta de
    // que el filtro estaba mal ANTES de reasignar medio padrón.
    if (empty($cuerpo['confirmar'])) {
        return ['coincidencias' => count($ids), 'confirmado' => false];
    }
    if (count($ids) === 0) {
        return ['asignadas' => 0, 'confirmado' => true];
    }

    // Se actualiza por identificadores ya resueltos, en una transacción: si algo
    // falla a la mitad no queda medio padrón repartido y medio no.
    $pdo->beginTransaction();
    try {
        $marcadores = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdo->prepare("
            UPDATE OSC SET asignado_a_id = ?, fecha_asignacion = ?
            WHERE id_osc IN ($marcadores)");
        $stmt->execute(array_merge([$usuarioId, $fecha], $ids));
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    // Un solo registro para el lote y no uno por organización: la bitácora
    // debe contar lo que una persona HIZO, y lo que hizo fue una operación.
    // Cientos de renglones idénticos ahogarían el resto del reporte.
    registrarBitacora($pdo, 'osc.asignar_lote', [
        'detalle' => count($ids) . ' organizaciones '
            . ($usuarioId === null ? 'quedaron sin responsable'
                                   : 'asignadas a ' . ($cuenta['nombre'] ?? "cuenta $usuarioId")),
    ]);

    return ['asignadas' => count($ids), 'usuario_id' => $usuarioId, 'confirmado' => true];
}, ['POST'], roles: ['admin']);

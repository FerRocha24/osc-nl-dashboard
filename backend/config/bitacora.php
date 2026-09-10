<?php
// Registro de movimientos. Cada acción que cambia algo deja constancia aquí.
//
// Se llama DESPUÉS de que la operación tuvo éxito, nunca antes: una bitácora
// que registra intenciones en vez de hechos miente sobre lo que pasó.

require_once __DIR__ . '/auth.php';

/**
 * Deja constancia de un movimiento.
 *
 * NUNCA lanza. Si escribir la bitácora falla, la operación que la provocó ya
 * ocurrió y no tiene sentido revertirla ni mostrarle un error a quien acaba de
 * aprobar un documento: el documento sí quedó aprobado. El fallo va al log del
 * servidor, que es donde lo verá quien opera el sistema.
 *
 * @param string $accion  "objeto.verbo": osc.denegar, documento.aprobar…
 * @param array  $datos   id_osc, id_documento, detalle (todos opcionales)
 */
function registrarBitacora(PDO $pdo, string $accion, array $datos = []): void
{
    try {
        $sesion = sesionActual();

        $stmt = $pdo->prepare(
            'INSERT INTO Bitacora (accion, id_osc, id_documento, usuario_id, usuario_nombre, detalle)
             VALUES (:accion, :osc, :doc, :uid, :nombre, :detalle)'
        );
        $stmt->bindValue(':accion', $accion);

        $osc = $datos['id_osc'] ?? null;
        $stmt->bindValue(':osc', $osc, $osc === null ? PDO::PARAM_NULL : PDO::PARAM_INT);

        $doc = $datos['id_documento'] ?? null;
        $stmt->bindValue(':doc', $doc, $doc === null ? PDO::PARAM_NULL : PDO::PARAM_INT);

        $uid = $sesion['id'] ?? null;
        $stmt->bindValue(':uid', $uid, $uid === null ? PDO::PARAM_NULL : PDO::PARAM_INT);

        // El nombre se congela: si la cuenta se renombra, lo que dice la
        // bitácora es quién era esa persona cuando hizo el movimiento.
        $stmt->bindValue(':nombre', $sesion['nombre'] ?? 'desconocido');

        $detalle = $datos['detalle'] ?? null;
        $stmt->bindValue(':detalle', $detalle, $detalle === null ? PDO::PARAM_NULL : PDO::PARAM_STR);

        $stmt->execute();
    } catch (Throwable $e) {
        error_log('No se pudo registrar en la bitácora (' . $accion . '): ' . $e->getMessage());
    }
}

/** Cómo se lee cada acción en el reporte. */
const ACCIONES_BITACORA = [
    'osc.aceptar'          => 'Aceptó la organización',
    'osc.denegar'          => 'Denegó la organización',
    'osc.reabrir'          => 'Reabrió la revisión',
    'osc.asignar'          => 'Asignó responsable',
    'osc.desasignar'       => 'Quitó el responsable',
    'osc.asignar_lote'     => 'Asignó responsable por lote',
    'osc.operacion'        => 'Actualizó el estatus de operación',
    'osc.ubicacion_fisica' => 'Registró la ubicación del expediente físico',
    'documento.subir'      => 'Subió un documento',
    'documento.aprobar'    => 'Aprobó un documento',
    'documento.rechazar'   => 'Rechazó un documento',
    'documento.vencido'    => 'Marcó un documento como vencido',
    'padron.importar'      => 'Importó el padrón',
    'usuario.crear'        => 'Creó una cuenta',
    'usuario.modificar'    => 'Modificó una cuenta',
];

<?php
// GET /endpoints/osc-detalle.php?id=12
// Ficha completa de una OSC, con su historial de apoyos.
//
// A DIFERENCIA de osc.php, este endpoint SÍ devuelve datos de contacto:
// dirección, teléfono, correos, nombre del contacto y de quien preside.
//
// Es una decisión deliberada. El listado no los expone porque nadie necesita
// 779 domicilios de golpe, y una fuga ahí sería masiva. La ficha individual sí
// los muestra porque es exactamente para lo que el personal del Registro la
// abre: contactar a una organización concreta. Toda la API exige sesión, así
// que ningún dato sale sin autenticación.

require_once __DIR__ . '/../config/api.php';

ejecutar(function () use ($pdo) {
    $id = $_GET['id'] ?? '';
    if (!preg_match('/^\d+$/', (string) $id)) {
        responderError("Falta el parámetro 'id' o no es un número.", 422);
    }
    $id = (int) $id;

    $donataria  = SQL_DONATARIA_VIGENTE;
    $estatusDoc = SQL_ESTATUS_DOCUMENTAL;
    $categoria  = SQL_CATEGORIA_RUBRO;
    $aprobados  = sqlDocumentosAprobados();

    $stmt = $pdo->prepare("
        SELECT
            o.id_osc, o.no_registro, o.razon_social, o.alias, o.siglas, o.rfc,
            o.rubro, o.sub_rubro, $categoria AS categoria,
            m.nombre_municipio AS municipio,
            o.direccion, o.telefono, o.correos, o.sitio_web,
            o.nombre_contacto, o.nombre_presidente,
            o.mision, o.vision, o.objeto_social, o.actividad_principal,
            o.fecha_registro, o.fecha_ultima_publicacion_dof,
            o.registrada_jbpnl,
            o.estatus_revision, o.motivo_revision,
            o.fecha_revision, o.revisado_por,
            o.asignado_a_id, ua.nombre AS asignado_a, o.fecha_asignacion,
            o.estatus_operacion, o.observaciones_estatus,
            o.ultima_fecha_visita, o.ultima_visita_observacion,
            $donataria  AS donataria_vigente,
            $estatusDoc AS estatus_documental,
            $aprobados  AS documentos_aprobados,
            MAX(d.fecha_entrega) AS ultima_actualizacion
        FROM OSC o
        LEFT JOIN Municipio     m ON m.id_municipio = o.id_municipio
        LEFT JOIN Documentacion d ON d.id_osc = o.id_osc
        LEFT JOIN Usuario      ua ON ua.id_usuario = o.asignado_a_id
        WHERE o.id_osc = :id
        GROUP BY o.id_osc, m.nombre_municipio,
                 o.estatus_revision, o.motivo_revision,
                 o.fecha_revision, o.revisado_por,
                 o.asignado_a_id, ua.nombre AS asignado_a, o.fecha_asignacion,
            o.estatus_operacion, o.observaciones_estatus,
                 o.ultima_fecha_visita, o.ultima_visita_observacion");
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();
    $osc = $stmt->fetch();

    if (!$osc) {
        responderError('No existe una organización con ese identificador.', 404);
    }

    $osc['id_osc'] = (int) $osc['id_osc'];
    $osc['documentos_aprobados'] = (int) $osc['documentos_aprobados'];
    $osc['asignado_a_id'] = $osc['asignado_a_id'] === null ? null : (int) $osc['asignado_a_id'];
    $osc['documentos_requeridos'] = count(DOCUMENTOS_REQUERIDOS);
    $osc['donataria_vigente'] = (bool) $osc['donataria_vigente'];
    $osc['registrada_jbpnl'] = (bool) $osc['registrada_jbpnl'];
    // Los correos vienen en un solo campo separados por "; " desde el CSV.
    $osc['correos'] = $osc['correos']
        ? array_values(array_filter(array_map('trim', explode(';', $osc['correos']))))
        : [];

    $etiqueta  = SQL_TIPO_APOYO_ETIQUETA;
    $poblacion = SQL_POBLACION_NORMALIZADA;

    $stmt = $pdo->prepare("
        SELECT a.id_apoyo, a.anio, $etiqueta AS tipo, $poblacion AS poblacion,
               a.linea_accion, a.fin_proposito, a.alcance
        FROM Apoyos a
        WHERE a.id_osc = :id
        ORDER BY a.anio DESC, a.id_apoyo ASC");
    $stmt->bindValue(':id', $id, PDO::PARAM_INT);
    $stmt->execute();

    $apoyos = array_map(static function (array $a): array {
        $a['id_apoyo'] = (int) $a['id_apoyo'];
        $a['anio'] = (int) $a['anio'];
        return $a;
    }, $stmt->fetchAll());

    return ['osc' => $osc, 'apoyos' => $apoyos];
});

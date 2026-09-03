-- Migración 010: expediente digital y flujo de revisión
--
-- La tabla Documentacion ya guardaba qué documento entregó cada OSC y en qué
-- estado estaba, pero no el archivo ni quién lo revisó. Esto agrega ambas
-- cosas.
--
-- El archivo NO se guarda en la base: en disco queda el binario y aquí solo
-- la referencia. Meter PDFs en MySQL infla los respaldos y hace lentas las
-- consultas que no los necesitan (que son casi todas).

ALTER TABLE Documentacion
    -- Nombre tal como lo subió la persona. Es SOLO para mostrar: nunca se usa
    -- para construir rutas, porque un nombre como "../../.ssh/authorized_keys"
    -- escaparía de la carpeta de archivos.
    ADD COLUMN nombre_original VARCHAR(255) AFTER tipo_documento,

    -- Nombre real en disco: generado al azar por el servidor, sin extensión
    -- tomada del usuario. Es lo que impide subir un .php y luego pedirlo.
    ADD COLUMN nombre_almacenado VARCHAR(64) AFTER nombre_original,

    -- Tipo detectado por el servidor leyendo los bytes del archivo, no el que
    -- declaró el navegador (que es texto libre y se puede falsificar).
    ADD COLUMN tipo_mime VARCHAR(100) AFTER nombre_almacenado,
    ADD COLUMN tamano_bytes INT UNSIGNED AFTER tipo_mime,

    -- Permite detectar duplicados y verificar que el archivo no se corrompió.
    ADD COLUMN hash_sha256 CHAR(64) AFTER tamano_bytes,

    ADD COLUMN fecha_subida DATETIME AFTER fecha_entrega,

    -- Auditoría de la revisión: quién decidió, cuándo y por qué.
    ADD COLUMN revisado_por VARCHAR(100) AFTER fecha_subida,
    ADD COLUMN fecha_revision DATETIME AFTER revisado_por,
    ADD COLUMN motivo_rechazo TEXT AFTER fecha_revision;

-- Se agrega 'Rechazado' al catálogo de estatus. Antes solo existían Completo,
-- Pendiente y Vencido, que describen la vigencia del documento pero no el
-- resultado de una revisión: un documento rechazado no es lo mismo que uno
-- que todavía nadie ha visto.
ALTER TABLE Documentacion
    MODIFY COLUMN estatus_validacion
        ENUM('Completo', 'Pendiente', 'Vencido', 'Rechazado')
        DEFAULT 'Pendiente';

-- Acelera la bandeja de revisión ("¿qué falta por revisar?"), que ordena por
-- fecha de subida dentro de un estatus.
CREATE INDEX idx_estatus_fecha ON Documentacion (estatus_validacion, fecha_subida);

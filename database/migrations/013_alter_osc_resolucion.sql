-- 013 · Resolución del Registro sobre cada OSC
--
-- Hasta ahora lo único que había era el estatus DOCUMENTAL, que se calcula
-- solo a partir de los documentos cargados y gana el peor de todos. Eso no
-- alcanza para decir si una organización quedó admitida en el padrón, por dos
-- razones:
--
--   1. No existe una lista cerrada de qué documentos debe entregar cada OSC,
--      así que ningún cálculo puede concluir "ya está completo": faltaría
--      saber cuántos faltan.
--   2. La resolución puede depender de cosas que no son documentos —una visita
--      al domicilio, que no haya evidencia de operación—, y eso no cabe en el
--      expediente.
--
-- Por eso la resolución la firma una persona. Los documentos siguen siendo la
-- evidencia; esta columna es la decisión.
--
-- Es distinta de estatus_operacion (Activa / Baja / Sin evidencia de
-- operación), que viene del padrón de la Secretaría y describe si la
-- organización opera, no si el Registro la admitió.

ALTER TABLE OSC
    ADD COLUMN estatus_revision
        ENUM('Pendiente', 'Aceptada', 'Denegada') NOT NULL DEFAULT 'Pendiente'
        AFTER estatus_operacion,

    -- Obligatorio al denegar: sin el motivo, la OSC no sabe qué corregir y
    -- quien revise después no sabe por qué se decidió así.
    ADD COLUMN motivo_revision TEXT AFTER estatus_revision,

    ADD COLUMN fecha_revision DATETIME AFTER motivo_revision,

    -- Se guarda quién resolvió, no solo qué se resolvió. Es el mismo criterio
    -- que en Documentacion: una resolución sin firma no es auditable.
    --
    -- Se guardan las dos cosas, el id y el nombre tal como estaba al resolver:
    -- el id para poder enlazar a la cuenta, y el nombre para que el histórico
    -- siga siendo legible si la cuenta se renombra o se desactiva. El nombre
    -- además cubre al administrador de arranque, que todavía no tiene fila en
    -- Usuario y por lo tanto no tiene id.
    ADD COLUMN revisado_por VARCHAR(150) AFTER fecha_revision,
    ADD COLUMN revisado_por_id INT AFTER revisado_por;

-- ON DELETE SET NULL y no CASCADE: si algún día se borrara una cuenta, la
-- resolución debe sobrevivir sin firma antes que desaparecer la OSC.
ALTER TABLE OSC
    ADD CONSTRAINT fk_osc_revisado_por
        FOREIGN KEY (revisado_por_id) REFERENCES Usuario (id_usuario)
        ON DELETE SET NULL;

-- La Vista Operativa filtra y cuenta por este campo en cada carga.
CREATE INDEX idx_estatus_revision ON OSC (estatus_revision);

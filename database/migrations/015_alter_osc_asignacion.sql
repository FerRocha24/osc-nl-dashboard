-- 015 · Quién es responsable de revisar cada OSC
--
-- Con 779 organizaciones idénticas en la lista, nadie sabe por dónde empezar
-- ni de quién es cada expediente. Esta columna reparte el padrón entre las
-- personas que revisan.
--
-- Una sola responsable por organización, no varias: en un registro de gobierno
-- lo que se necesita es saber a quién preguntarle por un expediente. Con dos
-- responsables, la respuesta es "a cualquiera de las dos", que en la práctica
-- significa ninguna.
--
-- Es distinto de revisado_por_id (migración 013): aquel dice quién RESOLVIÓ,
-- como hecho consumado; este dice a quién LE TOCA, que puede cambiar mientras
-- nadie haya resuelto todavía.

ALTER TABLE OSC
    ADD COLUMN asignado_a_id INT AFTER revisado_por_id,
    ADD COLUMN fecha_asignacion DATETIME AFTER asignado_a_id;

-- ON DELETE SET NULL y no CASCADE: si se borrara una cuenta, la organización
-- debe quedarse sin responsable, no desaparecer del padrón.
ALTER TABLE OSC
    ADD CONSTRAINT fk_osc_asignado_a
        FOREIGN KEY (asignado_a_id) REFERENCES Usuario (id_usuario)
        ON DELETE SET NULL;

-- "¿Qué me toca?" es la consulta que se hace en cada carga de la bandeja.
CREATE INDEX idx_asignado_a ON OSC (asignado_a_id);

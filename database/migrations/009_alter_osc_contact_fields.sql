-- Migración 009: Agrega campos de contacto a OSC
-- Estos campos existen en los datos reales del padrón (organizaciones.csv)
-- pero no se incluyeron en el modelo académico original de la Actividad 3.2.
-- Se agregan aquí como ALTER porque la tabla OSC ya existe en la base de datos.

ALTER TABLE OSC
    ADD COLUMN alias VARCHAR(255) AFTER razon_social,
    ADD COLUMN direccion VARCHAR(255) AFTER sub_rubro,
    ADD COLUMN telefono VARCHAR(50) AFTER direccion,
    ADD COLUMN correos VARCHAR(255) AFTER telefono,
    ADD COLUMN sitio_web VARCHAR(255) AFTER correos,
    ADD COLUMN nombre_contacto VARCHAR(150) AFTER sitio_web,
    ADD COLUMN nombre_presidente VARCHAR(150) AFTER nombre_contacto;

-- Migración 012: campos del padrón real del socio formador
--
-- El modelo original se diseñó a partir de la Actividad 3.2, antes de conocer
-- el archivo que la Secretaría usa en su operación diaria. Ese archivo tiene
-- 72 columnas y contiene datos que dábamos por inexistentes:
--
--   * latitud y longitud ya capturadas, lo que vuelve innecesario geocodificar
--     las 779 direcciones contra un servicio externo
--   * una clasificación general de rubro propia de la dependencia, que
--     sustituye a la agrupación que había propuesto el equipo de desarrollo
--   * un estatus a nivel organización (Activa, Baja, etc.), distinto del
--     estatus documental que ya teníamos
--
-- Esta migración acerca el modelo a esa realidad sin perder lo construido.

ALTER TABLE OSC
    -- ---- Clasificación -----------------------------------------------------
    -- Categoría general definida por la Secretaría. Es la que debe usarse en
    -- las gráficas: `rubro` guarda el rubro específico, que tiene 82 valores
    -- distintos y no comunica nada agregado.
    ADD COLUMN rubro_general VARCHAR(150) AFTER rubro,
    ADD COLUMN tipo_organizacion VARCHAR(150) AFTER rubro_general,

    -- ---- Domicilio ---------------------------------------------------------
    -- La colonia se guarda aparte: en el archivo viene separada, y tenerla
    -- suelta mejora tanto la búsqueda como una eventual geocodificación.
    ADD COLUMN colonia VARCHAR(150) AFTER direccion,

    -- ---- Contacto ----------------------------------------------------------
    -- El padrón admite hasta tres teléfonos, fax y celular. `telefono` ya
    -- existía y queda como el principal.
    ADD COLUMN telefono2 VARCHAR(50) AFTER telefono,
    ADD COLUMN telefono3 VARCHAR(50) AFTER telefono2,
    ADD COLUMN fax VARCHAR(50) AFTER telefono3,
    ADD COLUMN celular VARCHAR(50) AFTER fax,

    -- ---- Personas ----------------------------------------------------------
    -- Se guardan como texto porque así vienen en el archivo: un nombre por
    -- rol en la misma fila. La tabla Representante_Legal se conserva para
    -- cuando se capture el detalle completo (CURP, género, contacto propio).
    ADD COLUMN director VARCHAR(150) AFTER nombre_presidente,
    ADD COLUMN responsable VARCHAR(150) AFTER director,
    ADD COLUMN representante_legal VARCHAR(150) AFTER responsable,
    ADD COLUMN puesto_contacto VARCHAR(100) AFTER nombre_contacto,

    -- ---- Fechas ------------------------------------------------------------
    ADD COLUMN fecha_constitucion DATE AFTER fecha_registro,
    ADD COLUMN fecha_actualizacion DATE AFTER fecha_constitucion,

    -- ---- Estatus y seguimiento ---------------------------------------------
    -- Estatus de la ORGANIZACIÓN, que no es lo mismo que el estatus documental:
    -- una OSC puede estar activa y tener documentos pendientes, o estar de baja
    -- con su expediente completo.
    ADD COLUMN estatus_operacion
        ENUM('Activa', 'Actualizada', 'Baja', 'Sin evidencia de operación') AFTER tipo_organizacion,
    ADD COLUMN observaciones_estatus TEXT AFTER estatus_operacion,
    ADD COLUMN fecha_actualizacion_observaciones DATE AFTER observaciones_estatus,
    ADD COLUMN tipo_inmueble VARCHAR(100) AFTER observaciones_estatus,
    ADD COLUMN ultima_fecha_visita DATE AFTER tipo_inmueble,
    ADD COLUMN ultima_visita_observacion TEXT AFTER ultima_fecha_visita,
    ADD COLUMN horario_servicio VARCHAR(255) AFTER ultima_visita_observacion,

    -- ---- Ubicación ---------------------------------------------------------
    -- DECIMAL y no FLOAT: con punto flotante las coordenadas pierden precisión
    -- y un punto puede desplazarse decenas de metros. Siete decimales dan
    -- precisión de ~1 cm, más que suficiente.
    ADD COLUMN latitud DECIMAL(10,7) AFTER id_municipio,
    ADD COLUMN longitud DECIMAL(10,7) AFTER latitud;

-- Índices para los filtros nuevos del tablero.
CREATE INDEX idx_rubro_general ON OSC (rubro_general);
CREATE INDEX idx_estatus_operacion ON OSC (estatus_operacion);

-- Acelera dibujar solo las organizaciones que sí tienen punto en el mapa.
CREATE INDEX idx_coordenadas ON OSC (latitud, longitud);

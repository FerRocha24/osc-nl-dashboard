-- 017 · Bitácora de movimientos
--
-- POR QUÉ EXISTE
--
-- Hasta ahora el rastro de quién hizo qué vivía en las mismas columnas que el
-- estado: OSC.revisado_por, Documentacion.fecha_revision, etc. Eso sirve para
-- mostrar la ficha, pero no es auditoría: solo sobrevive el ÚLTIMO movimiento.
-- Si alguien acepta una organización, la reabre y luego la deniega, la base
-- conserva únicamente la negativa. Reabrir incluso borra la firma a propósito,
-- porque dejarla mostraría una resolución que ya no existe.
--
-- Un rastro que se puede sobrescribir no es un rastro. Esta tabla registra
-- cada acción cuando ocurre y no se modifica ni se borra nunca.
--
-- SIN LLAVES FORÁNEAS, A PROPÓSITO
--
-- Una bitácora no debe ser alcanzable por un borrado en cascada ni por un
-- ON DELETE SET NULL: si mañana se borrara una cuenta o una organización, el
-- registro de lo que hicieron tiene que sobrevivir intacto. Por eso se guardan
-- los identificadores sin restricción y, además, el NOMBRE congelado tal como
-- estaba al momento del movimiento.

CREATE TABLE Bitacora (
    id_evento BIGINT AUTO_INCREMENT PRIMARY KEY,

    fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Qué se hizo, en la forma "objeto.verbo": osc.denegar, documento.aprobar,
    -- padron.importar. Cadena y no ENUM: agregar una acción nueva no debería
    -- requerir una migración, y una bitácora que rechaza eventos desconocidos
    -- pierde justo los que más importa registrar.
    accion VARCHAR(40) NOT NULL,

    -- Sobre qué. Ambos pueden ser nulos: importar el padrón no es sobre una
    -- organización en particular.
    id_osc INT NULL,
    id_documento INT NULL,

    -- Quién. El id permite enlazar a la cuenta; el nombre mantiene legible el
    -- histórico aunque la cuenta se renombre o se desactive, y cubre al
    -- administrador de arranque, que no tiene fila en Usuario.
    usuario_id INT NULL,
    usuario_nombre VARCHAR(150) NOT NULL,

    -- El porqué o el qué: el motivo de una negativa, a quién se asignó, cuántas
    -- filas importó. Texto libre porque cada acción necesita explicar algo
    -- distinto.
    detalle TEXT NULL,

    -- El reporte se consulta por rango de fechas; la ficha, por organización.
    INDEX idx_fecha (fecha),
    INDEX idx_osc (id_osc),
    INDEX idx_usuario (usuario_id),
    INDEX idx_accion (accion)
);

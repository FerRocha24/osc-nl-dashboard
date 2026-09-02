-- Migración 004: Tabla Documentacion
-- Relación Uno a Muchos con OSC (una OSC sube varios documentos)

CREATE TABLE Documentacion (
    id_documento INT AUTO_INCREMENT PRIMARY KEY,
    id_osc INT NOT NULL,
    tipo_documento VARCHAR(100) NOT NULL,
    estatus_validacion ENUM('Completo', 'Pendiente', 'Vencido') DEFAULT 'Pendiente',
    fecha_entrega DATE,

    -- Índice para acelerar el filtro de "documentación incompleta"
    -- usado en la alerta de la Vista Operativa del Tablero Inteligente
    INDEX idx_estatus_validacion (estatus_validacion),
    INDEX idx_id_osc (id_osc),

    FOREIGN KEY (id_osc) REFERENCES OSC(id_osc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Migración 006: Tabla Fuente_Financiamiento
-- Relación Uno a Muchos con OSC (una OSC puede tener varias fuentes
-- de financiamiento distintas)

CREATE TABLE Fuente_Financiamiento (
    id_financiamiento INT AUTO_INCREMENT PRIMARY KEY,
    id_osc INT NOT NULL,
    tipo_fuente VARCHAR(100) NOT NULL,
    porcentaje DECIMAL(5,2) NOT NULL,

    -- Índice para acelerar el cálculo de fuentes de financiamiento
    -- por OSC al generar reportes
    INDEX idx_id_osc (id_osc),

    FOREIGN KEY (id_osc) REFERENCES OSC(id_osc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

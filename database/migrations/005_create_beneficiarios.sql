-- Migración 005: Tabla Beneficiarios
-- Relación Uno a Muchos con OSC (una OSC reporta varios registros,
-- uno por cada rango de edad)

CREATE TABLE Beneficiarios (
    id_beneficiario INT AUTO_INCREMENT PRIMARY KEY,
    id_osc INT NOT NULL,
    rango_edad VARCHAR(20) NOT NULL,
    num_hombres INT DEFAULT 0,
    num_mujeres INT DEFAULT 0,

    -- Índice para acelerar el JOIN entre OSC y sus beneficiarios
    -- al calcular totales (KPI: Total de beneficiarios atendidos)
    INDEX idx_id_osc (id_osc),

    FOREIGN KEY (id_osc) REFERENCES OSC(id_osc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

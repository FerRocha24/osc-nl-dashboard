-- Migración 008: Tabla Apoyos
-- Historial de apoyos/inversión social otorgados a las OSC (2023-2024)
-- Relación Uno a Muchos con OSC (una OSC puede recibir varios apoyos
-- a lo largo de distintos años)

CREATE TABLE Apoyos (
    id_apoyo INT AUTO_INCREMENT PRIMARY KEY,
    id_osc INT NULL,  -- NULL si no se pudo emparejar con el padrón maestro
    nombre_organizacion_original VARCHAR(255) NOT NULL,  -- nombre tal cual venía en el archivo fuente, para auditoría
    anio INT NOT NULL,
    tipo_apoyo VARCHAR(150),
    linea_accion TEXT,
    poblacion VARCHAR(150),
    fin_proposito TEXT,
    alcance TEXT,

    -- Índices para acelerar consultas del Tablero Inteligente
    INDEX idx_id_osc (id_osc),
    INDEX idx_anio (anio),

    FOREIGN KEY (id_osc) REFERENCES OSC(id_osc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

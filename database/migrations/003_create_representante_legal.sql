-- Migración 003: Tabla Representante_Legal
-- Relación Uno a Muchos con OSC (una OSC puede tener varios representantes
-- a lo largo del tiempo, pero cada representante pertenece a una sola OSC)

CREATE TABLE Representante_Legal (
    id_representante INT AUTO_INCREMENT PRIMARY KEY,
    id_osc INT NOT NULL,
    primer_apellido VARCHAR(100) NOT NULL,
    segundo_apellido VARCHAR(100),
    nombre VARCHAR(100) NOT NULL,
    telefono_oficina VARCHAR(20),
    celular VARCHAR(20),
    correo VARCHAR(150),
    genero VARCHAR(20),
    curp VARCHAR(18) UNIQUE,

    -- Índice para acelerar la búsqueda del representante de una OSC específica
    INDEX idx_id_osc (id_osc),

    FOREIGN KEY (id_osc) REFERENCES OSC(id_osc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

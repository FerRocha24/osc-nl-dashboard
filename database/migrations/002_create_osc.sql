-- Migración 002: Tabla OSC (entidad central)
-- Almacena la información principal de cada Organización de la Sociedad Civil

CREATE TABLE OSC (
    id_osc INT AUTO_INCREMENT PRIMARY KEY,
    no_registro VARCHAR(20) UNIQUE,
    fecha_registro DATE,
    razon_social VARCHAR(255) NOT NULL,
    siglas VARCHAR(50),
    rfc VARCHAR(13) UNIQUE,
    fecha_ultima_publicacion_dof DATE,
    mision TEXT,
    vision TEXT,
    objeto_social TEXT,
    actividad_principal VARCHAR(255),
    registrada_jbpnl BOOLEAN DEFAULT FALSE,
    rubro VARCHAR(100),
    sub_rubro VARCHAR(100),
    id_municipio INT,

    -- Índices para optimizar búsquedas frecuentes (Actividad 3.2)
    INDEX idx_municipio (id_municipio),
    INDEX idx_rubro (rubro),

    FOREIGN KEY (id_municipio) REFERENCES Municipio(id_municipio)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

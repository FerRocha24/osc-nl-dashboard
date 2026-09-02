-- Migración 001: Tabla Municipio (catálogo geográfico)
-- Se crea primero porque OSC tiene una llave foránea hacia esta tabla

CREATE TABLE Municipio (
    id_municipio INT AUTO_INCREMENT PRIMARY KEY,
    nombre_municipio VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Municipios de Nuevo León (datos iniciales de ejemplo)
INSERT INTO Municipio (nombre_municipio) VALUES
    ('Monterrey'),
    ('Guadalupe'),
    ('San Nicolás de los Garza'),
    ('Apodaca'),
    ('San Pedro Garza García'),
    ('Santa Catarina'),
    ('Escobedo'),
    ('Juárez'),
    ('Ciénega de Flores');

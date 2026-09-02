-- Migración 007: Tabla Transparencia
-- Relación Uno a Uno con OSC (cada OSC tiene un único registro
-- de transparencia/gobernanza asociado)

CREATE TABLE Transparencia (
    id_transparencia INT AUTO_INCREMENT PRIMARY KEY,
    id_osc INT NOT NULL UNIQUE,
    tiene_informe_anual BOOLEAN DEFAULT FALSE,
    tiene_estados_financieros BOOLEAN DEFAULT FALSE,
    tiene_organo_gobierno BOOLEAN DEFAULT FALSE,
    nombre_presidente_organo VARCHAR(150),
    num_reuniones_organo INT DEFAULT 0,
    nombre_director VARCHAR(150),

    FOREIGN KEY (id_osc) REFERENCES OSC(id_osc)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

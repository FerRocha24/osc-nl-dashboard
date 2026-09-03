-- Migración 011: usuarios del tablero
--
-- Hasta ahora el acceso era un solo usuario definido por variables de entorno
-- (AUTH_USUARIO / AUTH_PASSWORD_HASH). Servía para cerrar la puerta, pero no
-- para un registro de gobierno: toda la auditoría de revisiones decía "admin",
-- sin importar quién había decidido.

CREATE TABLE Usuario (
    id_usuario INT AUTO_INCREMENT PRIMARY KEY,

    -- Con qué se inicia sesión. Único e inmutable en la práctica.
    usuario VARCHAR(50) NOT NULL UNIQUE,

    -- Nombre real: es lo que se muestra en la auditoría ("Revisado por...").
    nombre VARCHAR(150) NOT NULL,
    correo VARCHAR(150),

    -- bcrypt de password_hash(). 255 caracteres porque el algoritmo por
    -- defecto de PHP puede cambiar en versiones futuras y producir hashes
    -- más largos que los 60 de bcrypt.
    password_hash VARCHAR(255) NOT NULL,

    -- admin    : todo, incluyendo administrar usuarios
    -- revisor  : sube documentos y aprueba o rechaza
    -- consulta : solo lectura del tablero
    rol ENUM('admin', 'revisor', 'consulta') NOT NULL DEFAULT 'consulta',

    -- Desactivar en lugar de borrar: si se borrara, las revisiones firmadas
    -- por esa persona se quedarían sin referencia y se perdería la auditoría.
    activo BOOLEAN NOT NULL DEFAULT TRUE,

    -- Obliga a cambiar la contraseña en el primer ingreso, para que la que
    -- asignó quien creó la cuenta no se quede puesta.
    debe_cambiar_password BOOLEAN NOT NULL DEFAULT TRUE,

    fecha_creacion DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    ultimo_acceso DATETIME,

    INDEX idx_activo (activo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- La auditoría de documentos pasa a apuntar al usuario, no a un texto suelto.
-- Se conserva revisado_por (el nombre en el momento de la revisión) para que
-- el registro histórico siga siendo legible aunque la persona cambie de
-- nombre o se desactive su cuenta.
ALTER TABLE Documentacion
    ADD COLUMN revisado_por_id INT AFTER revisado_por,
    ADD CONSTRAINT fk_documentacion_revisor
        FOREIGN KEY (revisado_por_id) REFERENCES Usuario(id_usuario);

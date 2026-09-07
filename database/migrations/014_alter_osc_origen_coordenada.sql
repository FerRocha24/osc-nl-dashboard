-- 014 · De dónde salió la coordenada de cada OSC
--
-- El padrón trae latitud y longitud capturadas en campo por la Secretaría,
-- pero hoy ninguna de las 779 las tiene: el archivo que se importó no incluía
-- esas columnas. Mientras tanto se pueden calcular a partir de la dirección
-- con un geocodificador.
--
-- Las dos clases NO son intercambiables y por eso se marcan:
--
--   padron      capturada por la Secretaría. Es el domicilio real.
--   aproximada  calculada de la dirección escrita. Cae en la cuadra correcta
--               casi siempre, pero no es el domicilio verificado.
--
-- Sin esta columna, en un mes nadie podría distinguirlas y alguien saldría a
-- una visita con una dirección calculada creyendo que fue verificada.
--
-- Además define la precedencia: al importar, una coordenada del padrón
-- sobrescribe una aproximada, nunca al revés.

ALTER TABLE OSC
    ADD COLUMN origen_coordenada ENUM('padron', 'aproximada') AFTER longitud;

-- Las que ya tuvieran coordenada solo pudieron venir de una importación.
UPDATE OSC
SET origen_coordenada = 'padron'
WHERE latitud IS NOT NULL AND longitud IS NOT NULL;

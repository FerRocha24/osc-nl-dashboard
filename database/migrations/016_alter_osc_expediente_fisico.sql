-- 016 · Dónde está el expediente en papel
--
-- Digitalizar no hace desaparecer el archivo físico: el acta constitutiva
-- original sigue en una carpeta, en un archivero, en una oficina. Quien revisa
-- necesita poder ir por ella, y hoy eso solo vive en la memoria de quien la
-- guardó.
--
-- Es texto LIBRE a propósito. Cada oficina numera sus archiveros a su manera
-- ("Archivero 3, gaveta B, carpeta 12", "Bodega, caja 2019-A", "con la Lic.
-- Martínez"), y un catálogo cerrado obligaría a inventar una nomenclatura que
-- nadie usa. Un campo que no se puede llenar como uno habla se queda vacío.
--
-- VARCHAR y no TEXT: es una referencia de una línea, no una nota. El límite
-- también avisa si alguien lo está usando para algo que no es.

ALTER TABLE OSC
    ADD COLUMN ubicacion_fisica VARCHAR(255) AFTER ultima_visita_observacion;

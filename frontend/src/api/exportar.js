// Generación y descarga de archivos desde el navegador, sin dependencias.

// Excel en español espera punto y coma como separador de lista. Con coma, todo
// el renglón cae en una sola columna, que es la queja clásica de quien abre un
// CSV "bien hecho". Google Sheets y LibreOffice detectan ambos.
const SEPARADOR = ";";

// Excel necesita la marca BOM al inicio para reconocer el archivo como UTF-8.
// Sin ella, "Ciénega" se ve como "CiÃ©nega" — el mismo problema de codificación
// que nos mordió al importar los datos, pero del lado del escritorio.
const BOM = "﻿";

function escaparCampo(valor) {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  // Se entrecomilla si trae el separador, comillas o saltos de línea. Varios
  // campos del padrón (misión, actividad principal) son textos largos.
  if (texto.includes(SEPARADOR) || texto.includes('"') || /[\r\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

/**
 * Construye un CSV.
 * @param {Array<{clave: string, titulo: string}>} columnas
 * @param {Array<object>} filas
 */
export function construirCsv(columnas, filas) {
  const encabezado = columnas.map((c) => escaparCampo(c.titulo)).join(SEPARADOR);
  const cuerpo = filas.map((fila) =>
    columnas.map((c) => escaparCampo(fila[c.clave])).join(SEPARADOR)
  );
  return BOM + [encabezado, ...cuerpo].join("\r\n");
}

// Dispara la descarga de un archivo generado en memoria.
export function descargarArchivo(nombre, contenido, tipo = "text/csv;charset=utf-8") {
  const blob = new Blob([contenido], { type: tipo });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombre;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);
  // Liberar el objeto de inmediato cancelaría la descarga en algunos
  // navegadores; un respiro basta.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Nombre de archivo con la fecha, para que varios reportes no se pisen.
export function nombreConFecha(base, extension) {
  const hoy = new Date();
  const fecha = [
    hoy.getFullYear(),
    String(hoy.getMonth() + 1).padStart(2, "0"),
    String(hoy.getDate()).padStart(2, "0"),
  ].join("-");
  return `${base}-${fecha}.${extension}`;
}

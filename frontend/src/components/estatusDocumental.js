/**
 * Color de cada estatus documental, en un solo lugar: lo usan la tabla del
 * padrón y el expediente de la ficha.
 *
 * Estaba duplicado, y la copia de la tabla se quedó sin "Rechazado" cuando se
 * agregó la revisión de documentos: una OSC con un documento rechazado salía
 * con la etiqueta sin color.
 */
export const CLASE_ESTATUS = {
  Completo: "verde",
  Pendiente: "advertencia",
  Vencido: "peligro",
  Rechazado: "peligro",
};

/** Los cuatro valores del ENUM de Documentacion, para desplegables. */
export const ESTATUS_DOCUMENTAL = ["Completo", "Pendiente", "Vencido", "Rechazado"];

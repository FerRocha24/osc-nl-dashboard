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

/**
 * Resolución del Registro sobre la OSC completa. No se deduce de los
 * documentos: no hay una lista cerrada de cuáles debe entregar cada
 * organización, así que "ya está completa" no se puede calcular. La firma
 * una persona desde la ficha.
 */
export const CLASE_RESOLUCION = {
  Aceptada: "verde",
  Denegada: "peligro",
  Pendiente: "neutro",
};

export const RESOLUCIONES = ["Pendiente", "Aceptada", "Denegada"];

/**
 * Estatus de operación: viene del padrón de la Secretaría (columna
 * EstatusObservacion del Excel) y describe si la organización SIGUE
 * FUNCIONANDO. No es lo mismo que la resolución del Registro: ninguno de sus
 * cuatro valores dice "no registrada", porque a la que le niegan el registro
 * nunca entra al padrón. "Baja" solo tiene sentido para algo que estuvo dentro.
 */
export const CLASE_OPERACION = {
  Activa: "verde",
  Actualizada: "verde",
  "Sin evidencia de operación": "advertencia",
  Baja: "peligro",
};

export const ESTATUS_OPERACION = [
  "Activa",
  "Actualizada",
  "Sin evidencia de operación",
  "Baja",
];

/** Lo que se muestra cuando el padrón todavía no trae el dato. */
export const OPERACION_SIN_DATO = "Sin dato";

/**
 * Etiqueta corta para la tabla. "Sin evidencia de operación" son 26
 * caracteres: en una celda parte el badge en dos renglones y descuadra la
 * fila. El texto completo se conserva en el title y en la ficha.
 */
export const OPERACION_CORTA = {
  "Sin evidencia de operación": "Sin evidencia",
};

/**
 * Color del avance del expediente.
 *
 * Cero no se pinta de rojo: hoy son las 779 y una pantalla completa en rojo
 * deja de comunicar urgencia, solo ruido. El rojo se reserva para lo que
 * alguien decidió —un documento rechazado—, no para lo que nadie ha hecho aún.
 */
export function claseAvance(aprobados, requeridos, estatusDocumental) {
  if (estatusDocumental === "Rechazado") return "peligro";
  if (requeridos > 0 && aprobados >= requeridos) return "verde";
  if (aprobados > 0) return "advertencia";
  return "neutro";
}

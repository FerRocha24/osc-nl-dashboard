/**
 * Los tres roles del tablero, en un solo lugar: los usa el alta de cuentas, el
 * selector de la tabla y el menú de perfil. Tenerlos duplicados hacía que un
 * rol nuevo se agregara en un sitio y se olvidara en otro.
 */
export const ROLES = [
  { valor: "admin",    etiqueta: "Administrador", ayuda: "Todo, incluyendo administrar cuentas" },
  { valor: "revisor",  etiqueta: "Revisor",       ayuda: "Sube documentos y aprueba o rechaza" },
  { valor: "consulta", etiqueta: "Consulta",      ayuda: "Solo lectura del tablero" },
];

export const NOMBRE_ROL = Object.fromEntries(ROLES.map((r) => [r.valor, r.etiqueta]));

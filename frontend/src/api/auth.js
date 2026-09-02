// Manejo de la sesión en el frontend.
//
// El token se guarda en sessionStorage (no en localStorage) a propósito: así
// muere al cerrar la pestaña, que es lo que se quiere en un tablero interno
// que puede abrirse en una computadora compartida de oficina.

const CLAVE_TOKEN = "osc_nl_token";
const CLAVE_USUARIO = "osc_nl_usuario";

// sessionStorage puede lanzar excepción (modo privado, políticas del navegador),
// así que todo acceso va envuelto.
function leer(clave) {
  try {
    return sessionStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave, valor) {
  try {
    if (valor === null) sessionStorage.removeItem(clave);
    else sessionStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento la sesión solo dura lo que dure la página cargada.
  }
}

export function obtenerToken() {
  return leer(CLAVE_TOKEN);
}

export function obtenerUsuario() {
  return leer(CLAVE_USUARIO);
}

// Suscripción sencilla para que App vuelva a renderizar cuando cambia la sesión
// (al iniciar, al cerrar, o cuando el backend responde 401 porque expiró).
const oyentes = new Set();

function avisar() {
  for (const cb of oyentes) cb(obtenerToken());
}

export function suscribirseASesion(cb) {
  oyentes.add(cb);
  return () => oyentes.delete(cb);
}

export function guardarSesion(token, usuario) {
  escribir(CLAVE_TOKEN, token);
  escribir(CLAVE_USUARIO, usuario ?? null);
  avisar();
}

export function cerrarSesion() {
  escribir(CLAVE_TOKEN, null);
  escribir(CLAVE_USUARIO, null);
  avisar();
}

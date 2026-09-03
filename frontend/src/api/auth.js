// Manejo de la sesión en el frontend.
//
// El token se guarda en sessionStorage (no en localStorage) a propósito: así
// muere al cerrar la pestaña, que es lo que se quiere en un tablero interno
// que puede abrirse en una computadora compartida de oficina.

const CLAVE_TOKEN = "osc_nl_token";
const CLAVE_USUARIO = "osc_nl_usuario";
const CLAVE_SESION = "osc_nl_sesion";

// Respaldo en memoria. sessionStorage puede fallar (modo privado, políticas
// del navegador) o no persistir entre recargas en algunos contextos. Sin este
// respaldo, la sesión se perdía en silencio y la persona quedaba atrapada en
// un bucle de inicio de sesión, sin mensaje de error.
const memoria = new Map();

function leer(clave) {
  try {
    const valor = sessionStorage.getItem(clave);
    if (valor !== null) return valor;
  } catch {
    // se cae al respaldo
  }
  return memoria.has(clave) ? memoria.get(clave) : null;
}

function escribir(clave, valor) {
  if (valor === null) memoria.delete(clave);
  else memoria.set(clave, valor);

  try {
    if (valor === null) sessionStorage.removeItem(clave);
    else sessionStorage.setItem(clave, valor);
  } catch {
    // Sin almacenamiento la sesión solo dura lo que dure la página cargada.
  }
}

/**
 * ¿El almacenamiento sobrevive a una recarga?
 *
 * Se comprueba escribiendo y volviendo a leer. Donde no persiste, recargar
 * tras iniciar sesión borraría el token recién obtenido.
 */
export function almacenamientoPersistente() {
  try {
    const clave = "osc_nl_prueba";
    sessionStorage.setItem(clave, "1");
    const ok = sessionStorage.getItem(clave) === "1";
    sessionStorage.removeItem(clave);
    return ok;
  } catch {
    return false;
  }
}

export function obtenerToken() {
  return leer(CLAVE_TOKEN);
}

export function obtenerUsuario() {
  return leer(CLAVE_USUARIO);
}

/**
 * Datos de la persona que inició sesión: nombre, rol y si debe cambiar su
 * contraseña. Es solo para decidir qué mostrar; los permisos de verdad los
 * aplica el backend en cada petición.
 */
export function obtenerSesion() {
  try {
    return JSON.parse(leer(CLAVE_SESION) ?? "null");
  } catch {
    return null;
  }
}

export function tieneRol(...roles) {
  const rol = obtenerSesion()?.rol;
  return rol ? roles.includes(rol) : false;
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

export function guardarSesion(token, usuario, datos = null) {
  escribir(CLAVE_TOKEN, token);
  escribir(CLAVE_USUARIO, usuario ?? null);
  escribir(CLAVE_SESION, datos ? JSON.stringify(datos) : null);
  avisar();
}

// Refresca los datos de la sesión sin tocar el token (por ejemplo, después de
// cambiar la contraseña, cuando ya no hace falta forzar el cambio).
export function actualizarSesion(cambios) {
  const actual = obtenerSesion() ?? {};
  escribir(CLAVE_SESION, JSON.stringify({ ...actual, ...cambios }));
  avisar();
}

export function cerrarSesion() {
  escribir(CLAVE_TOKEN, null);
  escribir(CLAVE_USUARIO, null);
  escribir(CLAVE_SESION, null);
  avisar();
}

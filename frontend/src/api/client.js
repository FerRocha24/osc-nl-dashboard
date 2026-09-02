// Cliente HTTP del dashboard: centraliza la URL base del backend de PHP,
// el manejo de errores y el hook de carga que usan las dos vistas.

import { useCallback, useEffect, useState } from "react";
import { cerrarSesion, guardarSesion, obtenerToken } from "./auth";

// La URL base viene del .env de Vite (VITE_API_URL). Se le quita la diagonal
// final para poder concatenar rutas sin generar "//" en medio.
const URL_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");

// Construye la URL de un endpoint con sus parámetros de query string.
// Los parámetros vacíos, nulos o en "Todos" se omiten, que es justo lo que
// el backend interpreta como "sin filtro".
function construirUrl(endpoint, params = {}) {
  const url = new URL(`${URL_BASE}/endpoints/${endpoint}`);
  for (const [clave, valor] of Object.entries(params)) {
    if (valor === null || valor === undefined || valor === "" || valor === "Todos") continue;
    url.searchParams.set(clave, valor);
  }
  return url.toString();
}

// Hace la petición y devuelve el JSON ya parseado.
// Lanza un Error con mensaje legible si algo falla, para que el hook lo pinte.
export async function pedirJson(endpoint, params = {}, señal, opciones = {}) {
  const token = obtenerToken();
  const cabeceras = { ...(opciones.headers ?? {}) };
  if (token) cabeceras.Authorization = `Bearer ${token}`;

  let respuesta;
  try {
    respuesta = await fetch(construirUrl(endpoint, params), {
      ...opciones,
      headers: cabeceras,
      signal: señal,
    });
  } catch (e) {
    // fetch solo rechaza por fallo de red; el caso típico es que el backend
    // de PHP no esté levantado.
    if (e.name === "AbortError") throw e;
    // En desarrollo se dice cómo levantar el backend; en producción ese texto
    // no le sirve a nadie del Registro y solo confunde.
    throw new Error(
      import.meta.env.DEV
        ? `No se pudo conectar con el backend en ${URL_BASE}. ` +
          `¿Está corriendo?  cd backend && PHP_CLI_SERVER_WORKERS=6 php -S localhost:8000`
        : "No se pudo conectar con el servidor. " +
          "Revisa tu conexión o inténtalo de nuevo en unos minutos."
    );
  }

  // El backend responde los errores como JSON ({"error": "..."}), así que se
  // intenta leer el mensaje real antes de caer al genérico.
  let datos;
  try {
    datos = await respuesta.json();
  } catch {
    throw new Error(`El backend respondió algo que no es JSON (HTTP ${respuesta.status}).`);
  }

  if (respuesta.status === 401) {
    // El token expiró o dejó de ser válido: se borra la sesión para que App
    // muestre la pantalla de acceso en vez de un error suelto en cada panel.
    cerrarSesion();
    throw new Error(datos?.error ?? "Tu sesión expiró. Vuelve a iniciar sesión.");
  }

  if (!respuesta.ok) {
    throw new Error(datos?.error ?? `Error del servidor (HTTP ${respuesta.status}).`);
  }
  return datos;
}

// Envía las credenciales y guarda la sesión si son correctas.
export async function iniciarSesion(usuario, password) {
  const datos = await pedirJson("login.php", {}, undefined, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ usuario, password }),
  });
  guardarSesion(datos.token, datos.usuario);
  return datos;
}

/**
 * Hook de carga de datos: pide un endpoint al montar y cada vez que cambian
 * sus parámetros, y expone { datos, cargando, error, recargar }.
 *
 * `params` se compara por su versión serializada, no por identidad de objeto:
 * así el efecto no se vuelve a disparar en cada render solo porque la página
 * construyó un objeto nuevo con los mismos valores.
 */
export function useApi(endpoint, params = {}, valorInicial = null) {
  const paramsSerializados = JSON.stringify(params);
  const [intento, setIntento] = useState(0);
  const recargar = useCallback(() => setIntento((n) => n + 1), []);

  // Identifica de forma única la petición que corresponde al render actual.
  const clave = `${endpoint}?${paramsSerializados}#${intento}`;

  // Se guarda junto a los datos la clave con la que se obtuvieron.
  const [resultado, setResultado] = useState({
    clave: null,
    datos: valorInicial,
    error: null,
  });

  useEffect(() => {
    const controlador = new AbortController();
    let vigente = true;

    pedirJson(endpoint, JSON.parse(paramsSerializados), controlador.signal)
      .then((datos) => {
        if (vigente) setResultado({ clave, datos, error: null });
      })
      .catch((e) => {
        // Una petición abortada (por desmontaje o cambio de filtro) no es un
        // error que haya que mostrarle a la persona usuaria.
        if (e.name === "AbortError" || !vigente) return;
        setResultado({ clave, datos: null, error: e.message });
      });

    return () => {
      vigente = false;
      controlador.abort();
    };
  }, [endpoint, paramsSerializados, clave]);

  // `cargando` se deriva en render en vez de guardarse en estado: si el
  // resultado que tenemos no corresponde a la petición actual, seguimos
  // esperando. Evita un setState extra (y un render extra) por cada carga.
  return {
    datos: resultado.datos,
    error: resultado.clave === clave ? resultado.error : null,
    cargando: resultado.clave !== clave,
    recargar,
  };
}

// Cliente HTTP del dashboard: centraliza la URL base del backend de PHP,
// el manejo de errores y el hook de carga que usan las dos vistas.

import { useCallback, useEffect, useState } from "react";
import { cerrarSesion, guardarSesion, obtenerToken } from "./auth";

// La URL base viene del .env de Vite (VITE_API_URL). Se le quita la diagonal
// final para poder concatenar rutas sin generar "//" en medio.
//
// Si viene vacía se usan rutas del mismo origen: en desarrollo el proxy de
// Vite (ver vite.config.js) las reenvía al PHP de localhost:8000, lo que
// evita el CORS por completo. En producción SIEMPRE debe estar definida,
// porque el frontend (Vercel) y el backend (EC2) están en dominios distintos.
const URL_BASE = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");

// Construye la URL de un endpoint con sus parámetros de query string.
// Los parámetros vacíos, nulos o en "Todos" se omiten, que es justo lo que
// el backend interpreta como "sin filtro".
function construirUrl(endpoint, params = {}) {
  const base = URL_BASE || window.location.origin;
  const url = new URL(`${base}/endpoints/${endpoint}`);
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
        ? `No se pudo conectar con el backend (${URL_BASE || "proxy de Vite → localhost:8000"}). ` +
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

/**
 * Descarga un archivo protegido y devuelve una URL temporal para mostrarlo.
 *
 * No se puede poner la URL del endpoint directo en un <iframe> o <embed>: el
 * navegador haría esa petición como una navegación normal, sin la cabecera
 * Authorization, y el servidor respondería 401. Se baja con fetch (que sí
 * lleva el token) y se envuelve en un blob.
 *
 * Quien llame es responsable de liberar la URL con URL.revokeObjectURL.
 */
export async function obtenerArchivo(endpoint, params = {}) {
  const token = obtenerToken();
  const respuesta = await fetch(construirUrl(endpoint, params), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (respuesta.status === 401) {
    cerrarSesion();
    throw new Error("Tu sesión expiró. Vuelve a iniciar sesión.");
  }
  if (!respuesta.ok) {
    // El endpoint devuelve JSON cuando falla, aunque normalmente mande binario.
    let mensaje = `No se pudo abrir el archivo (HTTP ${respuesta.status}).`;
    try {
      const datos = await respuesta.json();
      if (datos?.error) mensaje = datos.error;
    } catch { /* la respuesta no era JSON; se queda el mensaje genérico */ }
    throw new Error(mensaje);
  }

  const blob = await respuesta.blob();
  return { url: URL.createObjectURL(blob), tipo: blob.type };
}

// Envía datos a un endpoint que espera JSON por POST.
export async function enviarJson(endpoint, cuerpo) {
  return pedirJson(endpoint, {}, undefined, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cuerpo),
  });
}

/**
 * Sube un archivo. No se fija Content-Type a propósito: el navegador tiene que
 * ponerlo él para incluir el `boundary` que separa las partes del formulario.
 */
export async function subirArchivo(endpoint, formData) {
  return pedirJson(endpoint, {}, undefined, { method: "POST", body: formData });
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

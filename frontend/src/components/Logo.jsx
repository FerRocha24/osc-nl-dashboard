import { useState } from "react";
import "./Logo.css";

// Se intentan en orden. Vive en public/ y no se importa: así se puede
// reemplazar por el archivo que mande la Secretaría sin recompilar el
// frontend. Se aceptan los dos formatos para no obligar a convertirlo.
const ARCHIVOS = ["/logo-nl.svg", "/logo-nl.png"];

/**
 * Escudo de Nuevo León.
 *
 * Si ninguno de los archivos está, cae al distintivo de texto que había antes
 * en vez de dejar el ícono roto del navegador. No se dibuja un escudo
 * aproximado: es la imagen oficial de un gobierno, no un adorno, y uno mal
 * trazado sería peor que no ponerlo.
 */
export default function Logo({ alto = 34 }) {
  const [intento, setIntento] = useState(0);

  if (intento >= ARCHIVOS.length) {
    return <span className="logo__respaldo" style={{ width: alto, height: alto }}>OSC</span>;
  }

  return (
    <img
      className="logo"
      // La clave fuerza a React a montar un <img> nuevo al cambiar de archivo;
      // sin ella reusaría el mismo nodo y el navegador no reintentaría.
      key={ARCHIVOS[intento]}
      src={ARCHIVOS[intento]}
      // Decorativo: siempre va junto al nombre del tablero, y repetir
      // "Nuevo León" en el lector de pantalla solo estorba.
      alt=""
      style={{ height: alto }}
      onError={() => setIntento((n) => n + 1)}
    />
  );
}

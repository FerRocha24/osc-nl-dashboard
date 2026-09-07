import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { cerrarSesion, obtenerSesion, tieneRol } from "../api/auth";
import { NOMBRE_ROL } from "./roles";
import "./MenuPerfil.css";

/**
 * Toma las iniciales del nombre para el círculo del perfil.
 * "Ana Guerrero" -> "AG"; "Administrador inicial" -> "AI".
 * Se ignoran las partículas ("de", "la") para no acabar con una "D" que no
 * identifica a nadie.
 */
function iniciales(nombre) {
  const particulas = ["de", "del", "la", "las", "los", "y"];
  const palabras = (nombre ?? "")
    .trim()
    .split(/\s+/)
    .filter((p) => p && !particulas.includes(p.toLowerCase()));

  if (palabras.length === 0) return "?";
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}

export default function MenuPerfil({ onCambiarPassword }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);
  const sesion = obtenerSesion();
  const nombre = sesion?.nombre ?? "Sesión activa";

  useEffect(() => {
    if (!abierto) return;
    const clicFuera = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    const alPresionar = (e) => {
      if (e.key === "Escape") setAbierto(false);
    };
    document.addEventListener("mousedown", clicFuera);
    document.addEventListener("keydown", alPresionar);
    return () => {
      document.removeEventListener("mousedown", clicFuera);
      document.removeEventListener("keydown", alPresionar);
    };
  }, [abierto]);

  return (
    <div className="perfil" ref={ref}>
      <button
        type="button"
        className="perfil__avatar"
        onClick={() => setAbierto(!abierto)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        // El círculo solo muestra iniciales, así que necesita nombre accesible.
        aria-label={`Cuenta de ${nombre}`}
        title={nombre}
      >
        {iniciales(nombre)}
      </button>

      {abierto && (
        <div className="perfil__menu" role="menu">
          <div className="perfil__identidad">
            <p className="perfil__nombre">{nombre}</p>
            <p className="perfil__rol">{NOMBRE_ROL[sesion?.rol] ?? ""}</p>
          </div>

          {tieneRol("admin") && (
            /* Enlace y no botón: administrar cuentas es ir a otra pantalla, y
               así se puede abrir en otra pestaña como cualquier enlace. */
            <Link
              to="/usuarios"
              role="menuitem"
              className="perfil__opcion"
              onClick={() => setAbierto(false)}
            >
              Usuarios del tablero
            </Link>
          )}

          <button
            type="button"
            role="menuitem"
            className="perfil__opcion"
            onClick={() => {
              setAbierto(false);
              onCambiarPassword();
            }}
          >
            Cambiar contraseña
          </button>

          <button
            type="button"
            role="menuitem"
            className="perfil__opcion perfil__opcion--salir"
            onClick={cerrarSesion}
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from "react";
import { enviarJson } from "../api/client";
import { actualizarSesion, cerrarSesion } from "../api/auth";
import "./LoginPage.css";
import "./CambiarPassword.css";

/**
 * Cambio de contraseña, en dos presentaciones:
 *
 * - `obligatorio`: pantalla completa. Se muestra en el primer ingreso, porque
 *   quien crea la cuenta define una contraseña provisional y, si no se obliga
 *   a cambiarla, esa contraseña —que conoce otra persona— se queda puesta para
 *   siempre. Ahí no hay tablero detrás que valga la pena dejar ver.
 * - con `onCerrar`: ventana emergente sobre el tablero, desde el menú de
 *   perfil. Es un cambio voluntario y se puede abandonar a medias.
 */
export default function CambiarPassword({ obligatorio = false, onCerrar, onListo }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [listo, setListo] = useState(false);

  const esModal = !obligatorio && typeof onCerrar === "function";

  // Escape cierra la ventana y se bloquea el scroll del fondo. Nada de esto
  // aplica cuando el cambio es obligatorio: ahí no hay a dónde salir.
  useEffect(() => {
    if (!esModal) return;
    const alPresionar = (e) => {
      if (e.key === "Escape") onCerrar();
    };
    document.addEventListener("keydown", alPresionar);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alPresionar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [esModal, onCerrar]);

  const enviar = async (evento) => {
    evento.preventDefault();
    setError(null);

    if (nueva !== repetir) {
      setError("La contraseña nueva y su repetición no coinciden.");
      return;
    }

    setEnviando(true);
    try {
      await enviarJson("cambiar-password.php", { actual, nueva });
      setEnviando(false);
      // actualizarSesion avisa a App, que deja de mostrar esta pantalla
      // cuando el cambio era obligatorio.
      actualizarSesion({ debeCambiarPassword: false });

      if (esModal) {
        // En ventana emergente no cambia nada visible al terminar: si se
        // cerrara de golpe, quedaría la duda de si se guardó. Se confirma un
        // momento y luego se cierra sola.
        setListo(true);
        setTimeout(onCerrar, 1400);
        return;
      }
      onListo?.();
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  const formulario = (
    <form className="login__caja" onSubmit={enviar}>
      <div className="login__marca">
        <span className="login__logo">OSC</span>
        <span className="login__titulo">Cambia tu contraseña</span>
      </div>
      <p className="login__subtitulo">
        {obligatorio
          ? "Es tu primer ingreso. Define una contraseña que solo tú conozcas."
          : "Elige una contraseña nueva."}
      </p>

      <label className="login__campo">
        <span>Contraseña actual</span>
        <input type="password" autoComplete="current-password" value={actual}
          onChange={(e) => setActual(e.target.value)} required autoFocus
          disabled={listo} />
      </label>

      <label className="login__campo">
        <span>Contraseña nueva (mínimo 8 caracteres)</span>
        <input type="password" autoComplete="new-password" minLength={8} value={nueva}
          onChange={(e) => setNueva(e.target.value)} required disabled={listo} />
      </label>

      <label className="login__campo">
        <span>Repite la contraseña nueva</span>
        <input type="password" autoComplete="new-password" minLength={8} value={repetir}
          onChange={(e) => setRepetir(e.target.value)} required disabled={listo} />
      </label>

      {error && <p className="login__error" role="alert">{error}</p>}
      {listo && (
        <p className="cambiar__exito" role="status">Contraseña actualizada.</p>
      )}

      <button type="submit" className="login__boton" disabled={enviando || listo}>
        {enviando ? "Guardando…" : "Guardar contraseña"}
      </button>

      {obligatorio && (
        <button type="button" className="login__secundario" onClick={cerrarSesion}>
          Salir
        </button>
      )}
    </form>
  );

  if (!esModal) {
    return <div className="login">{formulario}</div>;
  }

  return (
    <div className="cambiar__fondo" onClick={onCerrar}>
      {/* El clic dentro de la ventana no debe cerrarla. */}
      <div
        className="cambiar"
        role="dialog"
        aria-modal="true"
        aria-label="Cambiar contraseña"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="cambiar__cerrar"
          onClick={onCerrar}
          aria-label="Cerrar"
        >
          ✕
        </button>
        {formulario}
      </div>
    </div>
  );
}

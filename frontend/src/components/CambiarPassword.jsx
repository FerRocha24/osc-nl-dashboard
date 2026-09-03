import { useState } from "react";
import { enviarJson } from "../api/client";
import { actualizarSesion, cerrarSesion } from "../api/auth";
import "./LoginPage.css";

/**
 * Pantalla de cambio de contraseña.
 *
 * Se muestra a fuerza en el primer ingreso: quien crea la cuenta define una
 * contraseña provisional, y si no se obliga a cambiarla, esa contraseña —que
 * conoce otra persona— se queda puesta para siempre.
 */
export default function CambiarPassword({ obligatorio = false, onListo }) {
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

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
      onListo?.();
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <div className="login">
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
            onChange={(e) => setActual(e.target.value)} required autoFocus />
        </label>

        <label className="login__campo">
          <span>Contraseña nueva (mínimo 8 caracteres)</span>
          <input type="password" autoComplete="new-password" minLength={8} value={nueva}
            onChange={(e) => setNueva(e.target.value)} required />
        </label>

        <label className="login__campo">
          <span>Repite la contraseña nueva</span>
          <input type="password" autoComplete="new-password" minLength={8} value={repetir}
            onChange={(e) => setRepetir(e.target.value)} required />
        </label>

        {error && <p className="login__error" role="alert">{error}</p>}

        <button type="submit" className="login__boton" disabled={enviando}>
          {enviando ? "Guardando…" : "Guardar contraseña"}
        </button>

        {obligatorio && (
          <button type="button" className="login__secundario" onClick={cerrarSesion}>
            Salir
          </button>
        )}
      </form>
    </div>
  );
}

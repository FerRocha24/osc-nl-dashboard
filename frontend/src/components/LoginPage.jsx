import { useState } from "react";
import { iniciarSesion } from "../api/client";
import "./LoginPage.css";
import Logo from "./Logo";

// Pantalla de acceso. El tablero maneja datos de contacto de organizaciones
// reales, así que no debe quedar abierto a quien tenga la URL.

export default function LoginPage() {
  const [usuario, setUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const enviar = async (evento) => {
    evento.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      // Al tener éxito, guardarSesion avisa a App y esta pantalla desaparece.
      // NO se recarga la página: hacerlo dependería de que el almacenamiento
      // del navegador sobreviva a la recarga, y donde no lo hace (modo
      // privado, políticas del sitio) el token recién obtenido se perdía y la
      // persona quedaba atrapada en un bucle de inicio de sesión sin ver
      // ningún error. App monta el tablero en un frame aparte, que es lo que
      // necesitaban las gráficas para medirse bien.
      await iniciarSesion(usuario.trim(), password);
    } catch (e) {
      setError(e.message);
      setEnviando(false);
    }
  };

  return (
    <div className="login">
      <form className="login__caja" onSubmit={enviar}>
        <div className="login__marca">
          <Logo alto={38} />
          <span className="login__titulo">Tablero Inteligente</span>
        </div>
        <p className="login__subtitulo">
          Registro Estatal de Organizaciones de la Sociedad Civil
        </p>

        <label className="login__campo">
          <span>Usuario</span>
          <input
            type="text"
            name="usuario"
            autoComplete="username"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            required
            autoFocus
          />
        </label>

        <label className="login__campo">
          <span>Contraseña</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="login__error" role="alert">{error}</p>}

        <button type="submit" className="login__boton" disabled={enviando}>
          {enviando ? "Entrando…" : "Entrar"}
        </button>
      </form>
    </div>
  );
}

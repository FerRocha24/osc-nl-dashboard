import { useState } from "react";
import { iniciarSesion } from "../api/client";
import "./LoginPage.css";

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
      await iniciarSesion(usuario.trim(), password);
      // Se recarga en vez de dejar que App intercambie la pantalla por el
      // tablero. Al hacer el intercambio en un solo commit de React, las
      // gráficas se montan antes de que el layout tenga sus medidas finales:
      // el ResponsiveContainer de Recharts mide un ancho de ~80px y no se
      // recupera después, ni siquiera con un evento de resize.
      //
      // Solo pasaba al entrar directo a /estrategica desde el login, pero es
      // una ruta que alguien puede tener en favoritos. La recarga conserva la
      // URL y el token (vive en sessionStorage), así que la persona aterriza
      // donde quería y con todo dibujado.
      window.location.reload();
      return;
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

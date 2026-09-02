import { NavLink } from "react-router-dom";
import ExportButton from "./ExportButton";
import { cerrarSesion, obtenerUsuario } from "../api/auth";
import "./Header.css";

export default function Header({ exportacion }) {
  const today = new Date().toLocaleDateString("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="dash-header">
      <div className="dash-header__brand">
        <span className="dash-header__logo">OSC</span>
        <span className="dash-header__title">Tablero Inteligente</span>
      </div>

      <nav className="dash-header__tabs">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            isActive ? "dash-tab dash-tab--active" : "dash-tab"
          }
        >
          Vista Operativa
        </NavLink>
        <NavLink
          to="/estrategica"
          className={({ isActive }) =>
            isActive ? "dash-tab dash-tab--active" : "dash-tab"
          }
        >
          Vista Estratégica
        </NavLink>
      </nav>

      <div className="dash-header__right">
        <span className="dash-header__date">{today}</span>
        <span className="dash-header__user">{obtenerUsuario() ?? "Sesión activa"}</span>
        <ExportButton exportacion={exportacion} />
        <button type="button" className="dash-header__salir" onClick={cerrarSesion}>
          Salir
        </button>
      </div>
    </header>
  );
}

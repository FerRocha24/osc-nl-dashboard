import { useState } from "react";
import { NavLink } from "react-router-dom";
import ExportButton from "./ExportButton";
import AdminUsuarios from "./AdminUsuarios";
import ImportarPadron from "./ImportarPadron";
import CambiarPassword from "./CambiarPassword";
import MenuPerfil from "./MenuPerfil";
import { tieneRol } from "../api/auth";
import "./Header.css";

export default function Header({ exportacion }) {
  const [panel, setPanel] = useState(null);
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
        <ExportButton exportacion={exportacion} />
        {tieneRol("admin") && (
          <>
            <button type="button" className="dash-header__accion" onClick={() => setPanel("importar")}>
              Importar
            </button>
            <button type="button" className="dash-header__accion" onClick={() => setPanel("usuarios")}>
              Usuarios
            </button>
          </>
        )}
        <MenuPerfil onCambiarPassword={() => setPanel("password")} />
      </div>

      {panel === "importar" && (
        <ImportarPadron
          onCerrar={() => setPanel(null)}
          // Recargar deja ver los datos recién importados sin que la persona
          // tenga que darse cuenta de que el tablero quedó desactualizado.
          onImportado={() => setTimeout(() => window.location.reload(), 1500)}
        />
      )}
      {panel === "usuarios" && <AdminUsuarios onCerrar={() => setPanel(null)} />}
      {panel === "password" && (
        <CambiarPassword onCerrar={() => setPanel(null)} />
      )}
    </header>
  );
}

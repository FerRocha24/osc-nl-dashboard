import { useState } from "react";
import { enviarJson, useApi } from "../api/client";
import { obtenerSesion } from "../api/auth";
import Estado from "./EstadoPanel";
import UsuarioNuevo from "./UsuarioNuevo";
import { ROLES } from "./roles";
import "./AdminUsuarios.css";

function formatearFecha(valor) {
  if (!valor) return "nunca";
  const f = new Date(valor.replace(" ", "T"));
  return Number.isNaN(f.getTime())
    ? "—"
    : f.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

/** Cuentas del tablero: quién entra, con qué rol y quién ya no debería entrar. */
export default function AdminUsuarios() {
  const { datos, cargando, error, recargar } = useApi("usuarios.php", {}, { usuarios: [] });
  const usuarios = datos?.usuarios ?? [];
  const yo = obtenerSesion();

  const [altaAbierta, setAltaAbierta] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [errorAccion, setErrorAccion] = useState(null);

  const cambiar = async (id, cambios) => {
    setErrorAccion(null);
    try {
      await enviarJson("usuario-guardar.php", { id, ...cambios });
      recargar();
    } catch (e) {
      setErrorAccion(e.message);
    }
  };

  const activas = usuarios.filter((u) => u.activo).length;

  return (
    <div className="admin">
      <div className="admin__barra">
        <p className="admin__resumen">
          {cargando
            ? "Cargando cuentas…"
            : `${usuarios.length} cuenta${usuarios.length === 1 ? "" : "s"}, ${activas} activa${activas === 1 ? "" : "s"}`}
        </p>
        <button type="button" className="admin__nuevo" onClick={() => setAltaAbierta(true)}>
          + Añadir usuario
        </button>
      </div>

      {aviso && <p className="admin__aviso" role="status">{aviso}</p>}
      {errorAccion && <p className="admin__error" role="alert">{errorAccion}</p>}

      <Estado cargando={cargando} error={error} onReintentar={recargar}
        vacio={usuarios.length === 0} alto={160}>
        <div className="admin__tabla-envoltura">
          <table className="admin__tabla">
            <thead>
              <tr>
                <th>Nombre</th><th>Usuario</th><th>Correo</th><th>Rol</th>
                <th>Último acceso</th><th>Estado</th><th />
              </tr>
            </thead>
            <tbody>
              {usuarios.map((u) => {
                const esYo = u.id_usuario === yo?.id;
                return (
                  <tr key={u.id_usuario} className={u.activo ? undefined : "admin__inactivo"}>
                    <td>
                      {u.nombre}
                      {esYo && <span className="admin__tu"> (tú)</span>}
                    </td>
                    <td>{u.usuario}</td>
                    <td className="admin__correo">{u.correo || "—"}</td>
                    <td>
                      <select
                        value={u.rol}
                        aria-label={`Rol de ${u.nombre}`}
                        onChange={(e) => cambiar(u.id_usuario, { rol: e.target.value })}
                      >
                        {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
                      </select>
                    </td>
                    <td>{formatearFecha(u.ultimo_acceso)}</td>
                    <td>
                      <span className={`status-badge status-badge--${u.activo ? "verde" : "peligro"}`}>
                        {u.activo ? "Activa" : "Inactiva"}
                      </span>
                    </td>
                    <td>
                      <button type="button"
                        onClick={() => cambiar(u.id_usuario, { activo: !u.activo })}>
                        {u.activo ? "Desactivar" : "Reactivar"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Estado>

      <p className="admin__nota">
        Las cuentas se desactivan, no se borran: si se borraran, las revisiones
        firmadas por esa persona se quedarían sin referencia y se perdería la
        auditoría.
      </p>

      {altaAbierta && (
        <UsuarioNuevo
          onCerrar={() => setAltaAbierta(false)}
          onCreado={(nombre) => {
            setAltaAbierta(false);
            setAviso(`Se creó la cuenta de ${nombre}.`);
            recargar();
          }}
        />
      )}
    </div>
  );
}

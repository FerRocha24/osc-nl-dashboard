import { useState } from "react";
import { enviarJson, useApi } from "../api/client";
import { obtenerSesion } from "../api/auth";
import Estado from "./EstadoPanel";
import "./AdminUsuarios.css";

const ROLES = [
  { valor: "admin",    etiqueta: "Administrador", ayuda: "Todo, incluyendo administrar cuentas" },
  { valor: "revisor",  etiqueta: "Revisor",       ayuda: "Sube documentos y aprueba o rechaza" },
  { valor: "consulta", etiqueta: "Consulta",      ayuda: "Solo lectura del tablero" },
];

const FORMULARIO_VACIO = { usuario: "", nombre: "", correo: "", rol: "consulta", password: "" };

function formatearFecha(valor) {
  if (!valor) return "nunca";
  const f = new Date(valor.replace(" ", "T"));
  return Number.isNaN(f.getTime())
    ? "—"
    : f.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

export default function AdminUsuarios({ onCerrar }) {
  const { datos, cargando, error, recargar } = useApi("usuarios.php", {}, { usuarios: [] });
  const usuarios = datos?.usuarios ?? [];
  const yo = obtenerSesion();

  const [form, setForm] = useState(FORMULARIO_VACIO);
  const [creando, setCreando] = useState(false);
  const [errorForm, setErrorForm] = useState(null);
  const [errorAccion, setErrorAccion] = useState(null);

  const crear = async (evento) => {
    evento.preventDefault();
    setErrorForm(null);
    setCreando(true);
    try {
      await enviarJson("usuario-guardar.php", form);
      setForm(FORMULARIO_VACIO);
      recargar();
    } catch (e) {
      setErrorForm(e.message);
    } finally {
      setCreando(false);
    }
  };

  const cambiar = async (id, cambios) => {
    setErrorAccion(null);
    try {
      await enviarJson("usuario-guardar.php", { id, ...cambios });
      recargar();
    } catch (e) {
      setErrorAccion(e.message);
    }
  };

  return (
    <div className="admin__fondo" onClick={onCerrar}>
      <div
        className="admin"
        role="dialog"
        aria-modal="true"
        aria-label="Administración de usuarios"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="admin__encabezado">
          <h2>Usuarios del tablero</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>

        <div className="admin__cuerpo">
          <form className="admin__form" onSubmit={crear}>
            <h3>Crear cuenta</h3>
            <div className="admin__campos">
              <label>
                <span>Usuario</span>
                <input value={form.usuario} required minLength={3} maxLength={50}
                  pattern="[a-zA-Z0-9._\-]+"
                  title="Letras, números, punto, guion o guion bajo"
                  onChange={(e) => setForm({ ...form, usuario: e.target.value })} />
              </label>
              <label>
                <span>Nombre completo</span>
                <input value={form.nombre} required
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
              </label>
              <label>
                <span>Correo (opcional)</span>
                <input type="email" value={form.correo}
                  onChange={(e) => setForm({ ...form, correo: e.target.value })} />
              </label>
              <label>
                <span>Rol</span>
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
                </select>
              </label>
              <label>
                <span>Contraseña provisional</span>
                <input type="password" value={form.password} required minLength={8}
                  autoComplete="new-password"
                  onChange={(e) => setForm({ ...form, password: e.target.value })} />
              </label>
            </div>
            <p className="admin__ayuda">
              {ROLES.find((r) => r.valor === form.rol)?.ayuda}. Se le pedirá cambiar la
              contraseña en su primer ingreso.
            </p>
            {errorForm && <p className="admin__error" role="alert">{errorForm}</p>}
            <button type="submit" disabled={creando}>{creando ? "Creando…" : "Crear cuenta"}</button>
          </form>

          {errorAccion && <p className="admin__error" role="alert">{errorAccion}</p>}

          <Estado cargando={cargando} error={error} onReintentar={recargar}
            vacio={usuarios.length === 0} alto={120}>
            <table className="admin__tabla">
              <thead>
                <tr>
                  <th>Nombre</th><th>Usuario</th><th>Rol</th>
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
          </Estado>

          <p className="admin__nota">
            Las cuentas se desactivan, no se borran: si se borraran, las revisiones
            firmadas por esa persona se quedarían sin referencia y se perdería la
            auditoría.
          </p>
        </div>
      </div>
    </div>
  );
}

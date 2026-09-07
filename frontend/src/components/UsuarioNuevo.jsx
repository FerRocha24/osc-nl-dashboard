import { useEffect, useState } from "react";
import { enviarJson } from "../api/client";
import { ROLES } from "./roles";
import "./UsuarioNuevo.css";

const FORMULARIO_VACIO = { usuario: "", nombre: "", correo: "", rol: "consulta", password: "" };

/**
 * Alta de cuenta, en ventana emergente sobre la lista de usuarios.
 *
 * Va aparte de la lista porque crear una cuenta es la excepción y revisarlas es
 * lo de todos los días: con el formulario siempre desplegado, la tabla —que es
 * lo que se viene a ver— quedaba empujada fuera de la pantalla.
 */
export default function UsuarioNuevo({ onCerrar, onCreado }) {
  const [form, setForm] = useState(FORMULARIO_VACIO);
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);

  useEffect(() => {
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
  }, [onCerrar]);

  const crear = async (evento) => {
    evento.preventDefault();
    setError(null);
    setCreando(true);
    try {
      await enviarJson("usuario-guardar.php", form);
      onCreado(form.nombre);
    } catch (e) {
      setError(e.message);
      setCreando(false);
    }
  };

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  return (
    <div className="alta__fondo" onClick={onCerrar}>
      {/* El clic dentro no debe cerrar el formulario a medio llenar. */}
      <form
        className="alta"
        role="dialog"
        aria-modal="true"
        aria-label="Añadir usuario"
        onClick={(e) => e.stopPropagation()}
        onSubmit={crear}
      >
        <header className="alta__encabezado">
          <h2>Añadir usuario</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>

        <div className="alta__campos">
          <label>
            <span>Usuario</span>
            <input value={form.usuario} required minLength={3} maxLength={50}
              pattern="[a-zA-Z0-9._\-]+" autoFocus
              title="Letras, números, punto, guion o guion bajo"
              onChange={cambiar("usuario")} />
          </label>
          <label>
            <span>Nombre completo</span>
            <input value={form.nombre} required onChange={cambiar("nombre")} />
          </label>
          <label>
            <span>Correo (opcional)</span>
            <input type="email" value={form.correo} onChange={cambiar("correo")} />
          </label>
          <label>
            <span>Contraseña provisional</span>
            <input type="password" value={form.password} required minLength={8}
              autoComplete="new-password" onChange={cambiar("password")} />
          </label>
        </div>

        <fieldset className="alta__roles">
          <legend>Rol</legend>
          {ROLES.map((r) => (
            <label key={r.valor} className="alta__rol">
              <input
                type="radio"
                name="rol"
                value={r.valor}
                checked={form.rol === r.valor}
                onChange={cambiar("rol")}
              />
              <span>
                <strong>{r.etiqueta}</strong>
                <em>{r.ayuda}</em>
              </span>
            </label>
          ))}
        </fieldset>

        <p className="alta__ayuda">
          Se le pedirá cambiar la contraseña en su primer ingreso, para que la
          provisional que defines aquí no se quede puesta.
        </p>

        {error && <p className="alta__error" role="alert">{error}</p>}

        <div className="alta__acciones">
          <button type="button" className="alta__cancelar" onClick={onCerrar}>Cancelar</button>
          <button type="submit" className="alta__guardar" disabled={creando}>
            {creando ? "Creando…" : "Crear cuenta"}
          </button>
        </div>
      </form>
    </div>
  );
}

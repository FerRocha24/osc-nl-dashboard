import { useEffect, useState } from "react";
import { enviarJson } from "../api/client";
import { ROLES } from "./roles";
import "./UsuarioNuevo.css";

const FORMULARIO_VACIO = { usuario: "", nombre: "", correo: "", rol: "consulta", password: "" };

// La primera cuenta arranca en Administrador y no en Consulta: es la única
// que puede ser de administrador, y dejarla en el valor de siempre invitaría a
// crearla mal justo en el momento en que equivocarse cuesta más caro.
const PRIMERA = { ...FORMULARIO_VACIO, rol: "admin" };

/**
 * Alta de cuenta, en ventana emergente sobre la lista de usuarios.
 *
 * Va aparte de la lista porque crear una cuenta es la excepción y revisarlas es
 * lo de todos los días: con el formulario siempre desplegado, la tabla —que es
 * lo que se viene a ver— quedaba empujada fuera de la pantalla.
 */
export default function UsuarioNuevo({ onCerrar, onCreado, esPrimera = false }) {
  const [form, setForm] = useState(esPrimera ? PRIMERA : FORMULARIO_VACIO);
  const [error, setError] = useState(null);
  const [creando, setCreando] = useState(false);
  // La confirmación solo aplica a la primera: a partir de la segunda, crear una
  // cuenta ya no cambia cómo se entra al sistema.
  const [entendido, setEntendido] = useState(false);

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
      const r = await enviarJson("usuario-guardar.php", form);
      onCreado(form.nombre, r?.era_la_primera === true);
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
          <h2>{esPrimera ? "Crear la primera cuenta" : "Añadir usuario"}</h2>
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

        {esPrimera && (
          <p className="alta__advertencia">
            <strong>Esta cuenta cambia la forma de entrar al tablero.</strong>{" "}
            Hoy se accede con el administrador inicial definido en el servidor.
            En cuanto exista una cuenta, ese acceso deja de funcionar y solo se
            podrá entrar con las cuentas de esta pantalla. Por eso la primera
            tiene que ser tuya y de rol Administrador: si te equivocas, recuperar
            el acceso requiere entrar al servidor por SSH.
          </p>
        )}

        <fieldset className="alta__roles">
          <legend>Rol</legend>
          {ROLES.map((r) => (
            <label key={r.valor} className="alta__rol">
              <input
                type="radio"
                name="rol"
                value={r.valor}
                checked={form.rol === r.valor}
                // En la primera cuenta los demás roles se bloquean aquí y el
                // backend los rechaza igual: esconder no es proteger.
                disabled={esPrimera && r.valor !== "admin"}
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

        {esPrimera && (
          <label className="alta__confirmar">
            <input
              type="checkbox"
              checked={entendido}
              onChange={(e) => setEntendido(e.target.checked)}
            />
            <span>
              Entiendo que a partir de ahora entraré con esta cuenta, y que
              guardé la contraseña en un lugar seguro.
            </span>
          </label>
        )}

        {error && <p className="alta__error" role="alert">{error}</p>}

        <div className="alta__acciones">
          <button type="button" className="alta__cancelar" onClick={onCerrar}>Cancelar</button>
          <button
            type="submit"
            className="alta__guardar"
            disabled={creando || (esPrimera && !entendido)}
          >
            {creando ? "Creando…" : esPrimera ? "Crear mi cuenta" : "Crear cuenta"}
          </button>
        </div>
      </form>
    </div>
  );
}

import { useState } from "react";
import { enviarJson, useApi } from "../api/client";
import { tieneRol } from "../api/auth";
import { cuentasAsignables } from "./asignables";
import "./AsignarOsc.css";

function formatearFecha(valor) {
  if (!valor) return null;
  const f = new Date(valor.replace(" ", "T"));
  return Number.isNaN(f.getTime())
    ? null
    : f.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Responsable de revisar una organización.
 *
 * Una sola persona, no varias: en un registro lo que se necesita es saber a
 * quién preguntarle por un expediente. Con dos responsables la respuesta es "a
 * cualquiera de las dos", que en la práctica significa ninguna.
 *
 * Es distinto de quién resolvió: eso es un hecho consumado y no se puede
 * cambiar; esto es a quién le toca, y se reasigna cuantas veces haga falta.
 */
export default function AsignarOsc({ osc, onAsignado }) {
  const puedeAsignar = tieneRol("admin");
  // Solo se pide la lista si hace falta: una cuenta de revisor no puede
  // consultar usuarios.php y recibiría un 403 por una pantalla que ni ve.
  const { datos } = useApi(puedeAsignar ? "usuarios.php" : null, {}, { usuarios: [] });
  const cuentas = cuentasAsignables(datos?.usuarios);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const asignar = async (valor) => {
    setError(null);
    setGuardando(true);
    try {
      await enviarJson("osc-asignar.php", {
        id: osc.id_osc,
        usuario_id: valor === "" ? null : Number(valor),
      });
      onAsignado?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const desde = formatearFecha(osc?.fecha_asignacion);

  return (
    <section className="asignar">
      <h3>Responsable de la revisión</h3>

      {!puedeAsignar && (
        <p className="asignar__texto">
          {osc?.asignado_a
            ? `Asignada a ${osc.asignado_a}${desde ? ` desde el ${desde}` : ""}.`
            : "Todavía no tiene responsable asignado."}
        </p>
      )}

      {puedeAsignar && (
        <>
          {cuentas.length === 0 ? (
            <p className="asignar__vacio">
              No hay cuentas de administrador o revisor a las que asignar.
              Créalas primero en <strong>Usuarios del tablero</strong>, dentro
              del menú de tu perfil.
            </p>
          ) : (
            <label className="asignar__campo">
              <span>Asignada a</span>
              <select
                value={osc?.asignado_a_id ?? ""}
                disabled={guardando}
                onChange={(e) => asignar(e.target.value)}
              >
                <option value="">Sin asignar</option>
                {cuentas.map((u) => (
                  <option key={u.id_usuario} value={u.id_usuario}>
                    {u.nombre} · {u.rol === "admin" ? "Administrador" : "Revisor"}
                  </option>
                ))}
              </select>
            </label>
          )}

          {osc?.asignado_a && desde && (
            <p className="asignar__meta">Asignada desde el {desde}.</p>
          )}
        </>
      )}

      {error && <p className="asignar__error" role="alert">{error}</p>}
    </section>
  );
}

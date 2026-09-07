import { useState } from "react";
import { enviarJson } from "../api/client";
import { tieneRol } from "../api/auth";
import {
  CLASE_OPERACION, ESTATUS_OPERACION, OPERACION_SIN_DATO,
} from "./estatusDocumental";
import "./OperacionOsc.css";

function formatearFecha(valor) {
  if (!valor) return null;
  const [a, m, d] = valor.split("-").map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

/**
 * Estatus de operación de la OSC: si sigue funcionando, y lo que lo sustenta.
 *
 * Se puede capturar a mano porque el trabajo de campo no puede esperar a que
 * alguien actualice el Excel y lo vuelva a subir: quien va de visita y ve que
 * la organización ya no existe necesita registrarlo el mismo día.
 *
 * Pero el archivo de la Secretaría sigue siendo la fuente de verdad del
 * padrón, así que la siguiente importación sobrescribe este campo si el CSV
 * trae valor. Eso se avisa en pantalla: un cambio que se revierte en silencio
 * es peor que no poder hacerlo.
 */
export default function OperacionOsc({ osc, onGuardado }) {
  const puedeEditar = tieneRol("admin", "revisor");
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);

  const [form, setForm] = useState({
    estatus: osc?.estatus_operacion ?? "",
    observaciones: osc?.observaciones_estatus ?? "",
    fecha_visita: osc?.ultima_fecha_visita ?? "",
    nota_visita: osc?.ultima_visita_observacion ?? "",
  });

  const estatus = osc?.estatus_operacion;
  const clase = CLASE_OPERACION[estatus] ?? "neutro";
  const visita = formatearFecha(osc?.ultima_fecha_visita);

  const abrir = () => {
    setForm({
      estatus: osc?.estatus_operacion ?? "",
      observaciones: osc?.observaciones_estatus ?? "",
      fecha_visita: osc?.ultima_fecha_visita ?? "",
      nota_visita: osc?.ultima_visita_observacion ?? "",
    });
    setError(null);
    setEditando(true);
  };

  const guardar = async (evento) => {
    evento.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      await enviarJson("osc-operacion.php", { id: osc.id_osc, ...form });
      setEditando(false);
      onGuardado?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  };

  const cambiar = (campo) => (e) => setForm({ ...form, [campo]: e.target.value });

  return (
    <section className="operacion">
      <h3>
        Operación
        <span className={`status-badge status-badge--${clase}`}>
          {estatus || OPERACION_SIN_DATO}
        </span>
      </h3>

      {!editando && (
        <>
          {osc?.observaciones_estatus && (
            <p className="operacion__texto">{osc.observaciones_estatus}</p>
          )}
          <p className="operacion__meta">
            {visita
              ? `Última visita: ${visita}`
              : "Sin visitas registradas."}
          </p>
          {osc?.ultima_visita_observacion && (
            <p className="operacion__texto">{osc.ultima_visita_observacion}</p>
          )}

          {puedeEditar && (
            <button type="button" className="operacion__editar" onClick={abrir}>
              {estatus ? "Actualizar" : "Capturar estatus"}
            </button>
          )}
        </>
      )}

      {editando && (
        <form className="operacion__form" onSubmit={guardar}>
          <label>
            <span>Estatus</span>
            <select value={form.estatus} onChange={cambiar("estatus")}>
              {/* Vacío devuelve la OSC a "Sin dato", para poder deshacer una
                  captura equivocada. */}
              <option value="">Sin dato</option>
              {ESTATUS_OPERACION.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>

          <label>
            <span>Observaciones</span>
            <textarea rows={2} maxLength={2000}
              value={form.observaciones} onChange={cambiar("observaciones")} />
          </label>

          <label>
            <span>Fecha de la última visita</span>
            <input type="date" max={new Date().toISOString().slice(0, 10)}
              value={form.fecha_visita} onChange={cambiar("fecha_visita")} />
          </label>

          <label>
            <span>Nota de la visita</span>
            <textarea rows={2} maxLength={2000}
              value={form.nota_visita} onChange={cambiar("nota_visita")} />
          </label>

          <p className="operacion__aviso">
            Este campo también viene del CSV del padrón. Si el archivo que se
            importe después trae un valor para esta organización, reemplazará lo
            que captures aquí.
          </p>

          {error && <p className="operacion__error" role="alert">{error}</p>}

          <div className="operacion__acciones">
            <button type="button" onClick={() => setEditando(false)}>Cancelar</button>
            <button type="submit" className="operacion__guardar" disabled={guardando}>
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

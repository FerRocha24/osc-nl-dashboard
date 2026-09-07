import { useState } from "react";
import { enviarJson } from "../api/client";
import { tieneRol } from "../api/auth";
import { CLASE_RESOLUCION } from "./estatusDocumental";
import "./ResolucionOsc.css";

function formatearFechaHora(valor) {
  if (!valor) return null;
  const f = new Date(valor.replace(" ", "T"));
  return Number.isNaN(f.getTime())
    ? null
    : f.toLocaleString("es-MX", {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
}

/**
 * Resolución del Registro sobre la organización completa.
 *
 * Va aparte de la revisión documento por documento porque responde otra
 * pregunta. El expediente dice cómo va el papeleo; esto dice si la OSC quedó
 * admitida, y no se puede deducir de lo anterior: no existe una lista cerrada
 * de qué documentos debe entregar cada organización, así que nunca se sabe si
 * ya están todos. Además la resolución puede depender de cosas que no son
 * documentos, como una visita al domicilio.
 */
export default function ResolucionOsc({ osc, onResuelto }) {
  const puedeResolver = tieneRol("admin", "revisor");
  const [motivo, setMotivo] = useState("");
  const [denegando, setDenegando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const estatus = osc?.estatus_revision ?? "Pendiente";
  const cuando = formatearFechaHora(osc?.fecha_revision);

  const resolver = async (decision, motivoTexto) => {
    setError(null);
    setEnviando(true);
    try {
      await enviarJson("osc-revisar.php", { id: osc.id_osc, decision, motivo: motivoTexto });
      setDenegando(false);
      setMotivo("");
      onResuelto?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <section className="resolucion">
      <h3>
        Resolución del Registro
        <span className={`status-badge status-badge--${CLASE_RESOLUCION[estatus] ?? "neutro"}`}>
          {estatus}
        </span>
      </h3>

      {osc?.motivo_revision && (
        <p className="resolucion__motivo">
          <strong>Motivo:</strong> {osc.motivo_revision}
        </p>
      )}

      {osc?.revisado_por ? (
        <p className="resolucion__firma">
          Resuelto por {osc.revisado_por}
          {cuando ? ` el ${cuando}` : ""}
        </p>
      ) : (
        <p className="resolucion__firma">
          Todavía nadie ha resuelto esta organización.
        </p>
      )}

      {error && <p className="resolucion__error" role="alert">{error}</p>}

      {puedeResolver && (
        <div className="resolucion__acciones">
          {estatus !== "Aceptada" && (
            <button type="button" className="resolucion__aceptar"
              disabled={enviando} onClick={() => resolver("aceptar")}>
              Aceptar organización
            </button>
          )}
          {estatus !== "Denegada" && (
            <button type="button" className="resolucion__denegar"
              disabled={enviando} onClick={() => setDenegando(true)}>
              Denegar
            </button>
          )}
          {estatus !== "Pendiente" && (
            /* Deshace un error y sirve para reabrir cuando la organización
               entrega lo que le faltaba. */
            <button type="button" className="resolucion__reabrir"
              disabled={enviando} onClick={() => resolver("reabrir")}>
              Reabrir
            </button>
          )}
        </div>
      )}

      {denegando && (
        <form
          className="resolucion__form"
          onSubmit={(e) => { e.preventDefault(); resolver("denegar", motivo); }}
        >
          <label htmlFor="motivo-resolucion">
            Motivo de la negativa (la organización necesita saber qué corregir)
          </label>
          <textarea
            id="motivo-resolucion"
            value={motivo}
            required
            maxLength={1000}
            rows={3}
            autoFocus
            onChange={(e) => setMotivo(e.target.value)}
          />
          <div className="resolucion__form-acciones">
            <button type="button" onClick={() => { setDenegando(false); setMotivo(""); }}>
              Cancelar
            </button>
            <button type="submit" className="resolucion__denegar" disabled={enviando}>
              {enviando ? "Guardando…" : "Confirmar negativa"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

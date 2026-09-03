import { useRef, useState } from "react";
import { enviarJson, obtenerArchivo, subirArchivo, useApi } from "../api/client";
import Estado from "./EstadoPanel";
import VisorArchivo from "./VisorArchivo";
import "./Expediente.css";

// Expediente digital de una OSC: subir documentos, verlos y decidir si se
// aprueban o se rechazan.

const TIPOS_SUGERIDOS = [
  "Acta constitutiva",
  "RFC / Constancia de situación fiscal",
  "Comprobante de domicilio",
  "Identificación del representante legal",
  "Estados financieros",
  "Informe anual de actividades",
  "Otro",
];

const CLASE_ESTATUS = {
  Completo: "verde",
  Pendiente: "advertencia",
  Vencido: "peligro",
  Rechazado: "peligro",
};

function formatearTamano(bytes) {
  if (!bytes) return "";
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatearFechaHora(valor) {
  if (!valor) return null;
  const f = new Date(valor.replace(" ", "T"));
  return Number.isNaN(f.getTime())
    ? null
    : f.toLocaleString("es-MX", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function Expediente({ idOsc }) {
  // Se reutiliza useApi en vez de repetir la carga a mano: ya resuelve el
  // estado de carga, la cancelación al desmontar y el 401 por sesión vencida.
  const { datos, cargando, error: errorCarga, recargar } = useApi(
    "documentos.php", { osc: idOsc }, { documentos: [] }
  );
  const documentos = datos?.documentos ?? [];
  const [error, setError] = useState(null);

  const [tipo, setTipo] = useState(TIPOS_SUGERIDOS[0]);
  const [subiendo, setSubiendo] = useState(false);
  const [errorSubida, setErrorSubida] = useState(null);
  const inputArchivo = useRef(null);

  const [viendo, setViendo] = useState(null);
  const [rechazando, setRechazando] = useState(null);
  const [motivo, setMotivo] = useState("");

  const alSubir = async (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    setSubiendo(true);
    setErrorSubida(null);
    try {
      const datos = new FormData();
      datos.append("osc", idOsc);
      datos.append("tipo_documento", tipo);
      datos.append("archivo", archivo);
      await subirArchivo("documento-subir.php", datos);
      recargar();
    } catch (e) {
      setErrorSubida(e.message);
    } finally {
      setSubiendo(false);
      // Se limpia para poder volver a elegir el mismo archivo si hizo falta.
      if (inputArchivo.current) inputArchivo.current.value = "";
    }
  };

  const decidir = async (id, decision, motivoTexto) => {
    try {
      await enviarJson("documento-revisar.php", { id, decision, motivo: motivoTexto });
      setRechazando(null);
      setMotivo("");
      recargar();
    } catch (e) {
      setError(e.message);
    }
  };

  const abrir = async (doc) => {
    try {
      const { url, tipo: mime } = await obtenerArchivo("documento-archivo.php", { id: doc.id_documento });
      setViendo({ url, mime, nombre: doc.nombre_original });
    } catch (e) {
      setError(e.message);
    }
  };

  const cerrarVisor = () => {
    // Sin revoke, el blob se queda en memoria hasta recargar la página.
    if (viendo?.url) URL.revokeObjectURL(viendo.url);
    setViendo(null);
  };

  return (
    <section className="expediente">
      <h3>
        Expediente digital
        <span className="expediente__conteo">{documentos.length}</span>
      </h3>

      <div className="expediente__subir">
        <label className="expediente__campo">
          <span>Tipo de documento</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} disabled={subiendo}>
            {TIPOS_SUGERIDOS.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="expediente__boton-archivo">
          {subiendo ? "Subiendo…" : "Elegir archivo"}
          <input
            ref={inputArchivo}
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={alSubir}
            disabled={subiendo}
          />
        </label>
        <p className="expediente__ayuda">PDF, JPG o PNG · máximo 10 MB</p>
      </div>

      {errorSubida && <p className="expediente__error" role="alert">{errorSubida}</p>}

      <Estado
        cargando={cargando}
        error={error ?? errorCarga}
        onReintentar={recargar}
        vacio={documentos.length === 0}
        mensajeVacio="Esta organización todavía no tiene documentos en su expediente."
        alto={120}
      >
        <ul className="expediente__lista">
          {documentos.map((d) => (
            <li key={d.id_documento} className="expediente__doc">
              <div className="expediente__doc-fila">
                <div className="expediente__doc-info">
                  <p className="expediente__doc-tipo">{d.tipo_documento}</p>
                  <p className="expediente__doc-meta">
                    {d.nombre_original}
                    {d.tamano_bytes ? ` · ${formatearTamano(d.tamano_bytes)}` : ""}
                    {formatearFechaHora(d.fecha_subida) ? ` · ${formatearFechaHora(d.fecha_subida)}` : ""}
                  </p>
                </div>
                <span className={`status-badge status-badge--${CLASE_ESTATUS[d.estatus_validacion] ?? "advertencia"}`}>
                  {d.estatus_validacion}
                </span>
              </div>

              {d.motivo_rechazo && (
                <p className="expediente__motivo">
                  <strong>Motivo del rechazo:</strong> {d.motivo_rechazo}
                </p>
              )}
              {d.revisado_por && (
                <p className="expediente__revision">
                  Revisado por {d.revisado_por}
                  {formatearFechaHora(d.fecha_revision) ? ` el ${formatearFechaHora(d.fecha_revision)}` : ""}
                </p>
              )}

              <div className="expediente__acciones">
                {d.tiene_archivo && (
                  <button type="button" onClick={() => abrir(d)}>Ver</button>
                )}
                <button type="button" className="expediente__aprobar" onClick={() => decidir(d.id_documento, "aprobar")}>
                  Aprobar
                </button>
                <button type="button" className="expediente__rechazar" onClick={() => setRechazando(d.id_documento)}>
                  Rechazar
                </button>
              </div>

              {rechazando === d.id_documento && (
                <form
                  className="expediente__rechazo"
                  onSubmit={(e) => { e.preventDefault(); decidir(d.id_documento, "rechazar", motivo); }}
                >
                  <label htmlFor={`motivo-${d.id_documento}`}>
                    Motivo del rechazo (la organización necesita saber qué corregir)
                  </label>
                  <textarea
                    id={`motivo-${d.id_documento}`}
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                    rows={2}
                    required
                    autoFocus
                  />
                  <div className="expediente__rechazo-acciones">
                    <button type="submit" className="expediente__rechazar">Confirmar rechazo</button>
                    <button type="button" onClick={() => { setRechazando(null); setMotivo(""); }}>Cancelar</button>
                  </div>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Estado>

      {viendo && <VisorArchivo {...viendo} onCerrar={cerrarVisor} />}
    </section>
  );
}

import { useState } from "react";
import { pedirJson } from "../api/client";
import { construirCsv, descargarArchivo, nombreConFecha } from "../api/exportar";
import "./ReporteMovimientos.css";

/** Los últimos 30 días: el periodo que casi siempre se quiere revisar. */
function rangoPorDefecto() {
  const hoy = new Date();
  const antes = new Date(hoy);
  antes.setDate(hoy.getDate() - 30);
  const iso = (f) => f.toISOString().slice(0, 10);
  return { desde: iso(antes), hasta: iso(hoy) };
}

function formatearFechaHora(valor) {
  if (!valor) return "";
  const f = new Date(valor.replace(" ", "T"));
  return Number.isNaN(f.getTime())
    ? valor
    : f.toLocaleString("es-MX", {
        day: "2-digit", month: "2-digit", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
}

/**
 * Reporte de movimientos.
 *
 * Sustituye al "Exportar reporte" anterior, que exportaba la página visible del
 * padrón y, en PDF, era literalmente la impresión de la pantalla. Eso no
 * responde ninguna pregunta que no se conteste mirando el tablero.
 *
 * Esto sí: qué se hizo, sobre qué organización, quién y cuándo. Es lo que se
 * anexa a un informe y lo que permite revisar el trabajo de un periodo.
 */
export default function ReporteMovimientos({ onCerrar }) {
  const [rango, setRango] = useState(rangoPorDefecto);
  const [datos, setDatos] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const consultar = async () => {
    setError(null);
    setCargando(true);
    try {
      // El límite alto es a propósito: un reporte parcial que no avisa que lo
      // es sería peor que uno lento.
      setDatos(await pedirJson("bitacora.php", { ...rango, limite: 2000 }));
    } catch (e) {
      setError(e.message);
      setDatos(null);
    } finally {
      setCargando(false);
    }
  };

  const descargar = () => {
    if (!datos?.eventos?.length) return;
    descargarArchivo(
      nombreConFecha("movimientos-osc", "csv"),
      construirCsv(
        [
          { clave: "fecha", titulo: "Fecha y hora" },
          { clave: "usuario_nombre", titulo: "Quién" },
          { clave: "accion_etiqueta", titulo: "Qué hizo" },
          { clave: "no_registro", titulo: "Folio" },
          { clave: "razon_social", titulo: "Organización" },
          { clave: "detalle", titulo: "Detalle" },
        ],
        datos.eventos.map((e) => ({ ...e, fecha: formatearFechaHora(e.fecha) }))
      )
    );
  };

  const eventos = datos?.eventos ?? [];

  return (
    <div className="reporte__fondo" onClick={onCerrar}>
      <div
        className="reporte"
        role="dialog"
        aria-modal="true"
        aria-label="Reporte de movimientos"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="reporte__encabezado">
          <h2>Reporte de movimientos</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar">✕</button>
        </header>

        <div className="reporte__cuerpo">
          <div className="reporte__rango">
            <label>
              <span>Desde</span>
              <input type="date" value={rango.desde} max={rango.hasta}
                onChange={(e) => setRango({ ...rango, desde: e.target.value })} />
            </label>
            <label>
              <span>Hasta</span>
              <input type="date" value={rango.hasta} min={rango.desde}
                max={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setRango({ ...rango, hasta: e.target.value })} />
            </label>
            <button type="button" className="reporte__consultar"
              disabled={cargando} onClick={consultar}>
              {cargando ? "Consultando…" : "Consultar"}
            </button>
          </div>

          {error && <p className="reporte__error" role="alert">{error}</p>}

          {datos && (
            <>
              <div className="reporte__resumen">
                <p>
                  <strong>{datos.total.toLocaleString("es-MX")}</strong> movimientos
                  {datos.total > eventos.length &&
                    ` (se muestran los ${eventos.length.toLocaleString("es-MX")} más recientes)`}
                </p>
                {datos.por_persona?.length > 0 && (
                  <ul className="reporte__personas">
                    {datos.por_persona.map((p) => (
                      <li key={p.nombre}>
                        {p.nombre}
                        <span>{p.movimientos.toLocaleString("es-MX")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {eventos.length === 0 ? (
                <p className="reporte__vacio">
                  No hubo movimientos en este periodo. La bitácora registra
                  desde que se instaló; lo anterior a esa fecha no quedó
                  guardado.
                </p>
              ) : (
                <>
                  <div className="reporte__tabla-envoltura">
                    <table className="reporte__tabla">
                      <thead>
                        <tr>
                          <th>Fecha</th><th>Quién</th><th>Qué hizo</th>
                          <th>Organización</th><th>Detalle</th>
                        </tr>
                      </thead>
                      <tbody>
                        {eventos.map((e) => (
                          <tr key={e.id_evento}>
                            <td className="reporte__fecha">{formatearFechaHora(e.fecha)}</td>
                            <td>{e.usuario_nombre}</td>
                            <td>{e.accion_etiqueta}</td>
                            <td>
                              {e.razon_social
                                ? <>{e.razon_social}{e.no_registro && <span className="reporte__folio"> · {e.no_registro}</span>}</>
                                : <span className="reporte__sin">—</span>}
                            </td>
                            <td className="reporte__detalle">{e.detalle ?? ""}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="reporte__acciones">
                    <button type="button" className="reporte__descargar" onClick={descargar}>
                      Descargar CSV
                    </button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

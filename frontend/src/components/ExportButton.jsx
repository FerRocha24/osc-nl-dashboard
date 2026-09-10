import { useState, useRef, useEffect } from "react";
import { tieneRol } from "../api/auth";
import { construirCsv, descargarArchivo, nombreConFecha } from "../api/exportar";
import "./ExportButton.css";

/**
 * Botón de exportación del header.
 *
 * Recibe la configuración de la vista en la que está, porque cada una exporta
 * cosas distintas: la Operativa el padrón filtrado, la Estratégica los
 * agregados. `obtenerDatos` es asíncrona porque la Operativa vuelve a pedir
 * TODAS las filas que cumplen el filtro, no solo la página que se ve.
 */
export default function ExportButton({ exportacion, onReporte }) {
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    function clicFuera(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setAbierto(false);
        setError(null);
      }
    }
    document.addEventListener("mousedown", clicFuera);
    return () => document.removeEventListener("mousedown", clicFuera);
  }, []);

  const exportarCsv = async () => {
    if (!exportacion) return;
    setOcupado(true);
    setError(null);
    try {
      const { columnas, filas } = await exportacion.obtenerDatos();
      if (!filas.length) {
        setError("No hay datos que exportar con los filtros actuales.");
        return;
      }
      descargarArchivo(
        nombreConFecha(exportacion.nombre, "csv"),
        construirCsv(columnas, filas)
      );
      setAbierto(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="export-btn" ref={ref}>
      <button
        type="button"
        className="export-btn__trigger"
        onClick={() => setAbierto(!abierto)}
        disabled={!exportacion && !onReporte}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Exportar reporte
      </button>

      {abierto && (
        <div className="export-btn__menu">
          <button type="button" className="export-btn__item" onClick={exportarCsv} disabled={ocupado}>
            <span className="export-btn__icon export-btn__icon--xls">CSV</span>
            {ocupado ? "Preparando…" : (exportacion?.etiquetaCsv ?? "Exportar datos")}
          </button>
          {/* Antes había aquí un "Imprimir o guardar en PDF" que llamaba a
              window.print(): era una captura de la pantalla, no un reporte, y
              no respondía ninguna pregunta que no se conteste mirando el
              tablero. Lo sustituye el reporte de movimientos, que sí dice qué
              se hizo, sobre qué organización, quién y cuándo. */}
          {tieneRol("admin", "revisor") && (
            <button
              type="button"
              className="export-btn__item"
              onClick={() => { setAbierto(false); onReporte?.(); }}
            >
              <span className="export-btn__icon export-btn__icon--mov">LOG</span>
              Reporte de movimientos
            </button>
          )}
          {error && <p className="export-btn__error" role="alert">{error}</p>}
        </div>
      )}
    </div>
  );
}

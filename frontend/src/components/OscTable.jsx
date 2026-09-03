import Estado from "./EstadoPanel";
import "./OscTable.css";

function StatusBadge({ status }) {
  const map = {
    Completo: "verde",
    Pendiente: "advertencia",
    Vencido: "peligro",
  };
  return <span className={`status-badge status-badge--${map[status]}`}>{status}</span>;
}

// Las fechas llegan del backend como 'YYYY-MM-DD' o null. Se construyen con
// los componentes por separado para evitar que el navegador interprete la
// cadena como UTC y muestre el día anterior.
function formatearFecha(valor) {
  if (!valor) return "—";
  const [anio, mes, dia] = valor.split("-").map(Number);
  if (!anio || !mes || !dia) return "—";
  return new Date(anio, mes - 1, dia).toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

export default function OscTable({
  osc = [], total = 0, pagina = 1, limite = 10,
  cargando, error, onReintentar, onCambiarPagina, onSeleccionar,
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  const desde = total === 0 ? 0 : (pagina - 1) * limite + 1;
  const hasta = Math.min(pagina * limite, total);

  // Ventana de páginas alrededor de la actual: con 779 OSC son 78 páginas y
  // no se pueden pintar todas.
  const inicioVentana = Math.max(1, Math.min(pagina - 1, totalPaginas - 2));
  const paginasVisibles = [inicioVentana, inicioVentana + 1, inicioVentana + 2]
    .filter((n) => n >= 1 && n <= totalPaginas);

  return (
    <div className="osc-table-wrapper">
      <Estado
        cargando={cargando}
        error={error}
        onReintentar={onReintentar}
        vacio={osc.length === 0}
        mensajeVacio="Ninguna organización coincide con los filtros seleccionados."
        alto={260}
      >
        <table className="osc-table">
          <thead>
            <tr>
              {/* Folio del Registro Estatal (no_registro): es el identificador
                  con el que el personal del socio formador busca una OSC. */}
              <th>Folio</th>
              <th>Razón Social</th>
              <th>Municipio</th>
              <th>Rubro</th>
              <th>Estatus documental</th>
              <th>Última actualización</th>
            </tr>
          </thead>
          <tbody>
            {osc.map((row) => (
              // La fila entera abre la ficha. Se usa tabIndex y onKeyDown para
              // que también funcione con el teclado, no solo con el ratón.
              <tr
                key={row.id_osc}
                className="osc-table__fila--clic"
                tabIndex={0}
                role="button"
                aria-label={`Ver ficha de ${row.razon_social}`}
                onClick={() => onSeleccionar?.(row.id_osc)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSeleccionar?.(row.id_osc);
                  }
                }}
              >
                <td className="osc-table__folio">{row.no_registro ?? "—"}</td>
                <td className="osc-table__razon">{row.razon_social}</td>
                <td>{row.municipio ?? "—"}</td>
                <td>{row.rubro ?? "—"}</td>
                <td><StatusBadge status={row.estatus_documental} /></td>
                <td>{formatearFecha(row.ultima_actualizacion)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Estado>

      <div className="osc-table__pagination">
        <span>
          {total === 0
            ? "Sin organizaciones que mostrar"
            : `Mostrando ${desde}–${hasta} de ${total.toLocaleString("es-MX")} organizaciones`}
        </span>
        <nav className="osc-table__pagination-controls" aria-label="Paginación del padrón">
          <button
            type="button"
            disabled={pagina <= 1 || cargando}
            onClick={() => onCambiarPagina?.(pagina - 1)}
          >
            Anterior
          </button>
          {paginasVisibles.map((n) => (
            <button
              type="button"
              key={n}
              className={n === pagina ? "osc-table__page-active" : undefined}
              // Un lector de pantalla solo oiría "1", "2", "3" sueltos;
              // aria-current le dice en cuál está parada la persona.
              aria-label={`Página ${n}`}
              aria-current={n === pagina ? "page" : undefined}
              disabled={cargando}
              onClick={() => onCambiarPagina?.(n)}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={pagina >= totalPaginas || cargando}
            onClick={() => onCambiarPagina?.(pagina + 1)}
          >
            Siguiente
          </button>
        </nav>
      </div>
    </div>
  );
}

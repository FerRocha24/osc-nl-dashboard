import { useState } from "react";
import Estado from "./EstadoPanel";
import { CLASE_ESTATUS, CLASE_RESOLUCION } from "./estatusDocumental";
import "./OscTable.css";

function ResolucionBadge({ resolucion }) {
  const clase = CLASE_RESOLUCION[resolucion] ?? "neutro";
  return <span className={`status-badge status-badge--${clase}`}>{resolucion}</span>;
}

function StatusBadge({ status }) {
  // El respaldo importa: si mañana se agrega un estatus al ENUM y se olvida
  // aquí, sale una etiqueta ámbar y no una sin color.
  const clase = CLASE_ESTATUS[status] ?? "advertencia";
  return <span className={`status-badge status-badge--${clase}`}>{status}</span>;
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
  // Lo que se está tecleando en "Ir a la página". Se guarda como texto y no
  // como número para poder dejar el campo vacío mientras se borra.
  const [destino, setDestino] = useState("");

  const totalPaginas = Math.max(1, Math.ceil(total / limite));
  const desde = total === 0 ? 0 : (pagina - 1) * limite + 1;
  const hasta = Math.min(pagina * limite, total);

  // Ventana de páginas alrededor de la actual: con 779 OSC son 78 páginas y
  // no se pueden pintar todas.
  const inicioVentana = Math.max(1, Math.min(pagina - 1, totalPaginas - 2));
  const paginasVisibles = [inicioVentana, inicioVentana + 1, inicioVentana + 2]
    .filter((n) => n >= 1 && n <= totalPaginas);

  const irADestino = (evento) => {
    evento.preventDefault();
    const n = Number.parseInt(destino, 10);
    // Fuera de rango no se rechaza con un error: se va al extremo más cercano,
    // que es lo que la persona quería al escribir 999 en un padrón de 78.
    if (Number.isNaN(n)) return;
    onCambiarPagina?.(Math.min(Math.max(n, 1), totalPaginas));
    setDestino("");
  };

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
              {/* Dos columnas y no una: el expediente dice cómo va el
                  papeleo, la resolución dice si la OSC quedó admitida.
                  Responden preguntas distintas. */}
              <th>Expediente</th>
              <th>Resolución</th>
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
                <td><ResolucionBadge resolucion={row.estatus_revision ?? "Pendiente"} /></td>
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

        {/* Con 78 páginas, llegar a la 60 a punta de "Siguiente" son 59 clics.
            Solo aparece cuando hay más páginas de las que caben en la fila. */}
        {totalPaginas > 3 && (
          <form
            className="osc-table__ir"
            onSubmit={irADestino}
            // Sin esto el navegador bloquea el envío en silencio al escribir un
            // número mayor que max, y nunca corre el ajuste al rango de abajo.
            // min/max se quedan: acotan las flechitas y el lector de pantalla
            // anuncia hasta dónde llega el padrón.
            noValidate
          >
            <label htmlFor="osc-ir-pagina">Ir a la página</label>
            <input
              id="osc-ir-pagina"
              type="number"
              min={1}
              max={totalPaginas}
              inputMode="numeric"
              placeholder={String(pagina)}
              value={destino}
              disabled={cargando}
              onChange={(e) => setDestino(e.target.value)}
            />
            <span>de {totalPaginas.toLocaleString("es-MX")}</span>
            <button type="submit" disabled={cargando || destino === ""}>Ir</button>
          </form>
        )}
      </div>
    </div>
  );
}

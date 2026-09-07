import "./ChartPanel.css";

/**
 * `acciones` va a la derecha del título: es para controles que cambian lo que
 * el panel muestra (alternar entre dos mapas, por ejemplo), no para acciones
 * del tablero.
 */
export default function ChartPanel({ title, children, acciones, span = 1 }) {
  return (
    <div className="chart-panel" style={{ gridColumn: `span ${span}` }}>
      <div className="chart-panel__encabezado">
        <h3 className="chart-panel__title">{title}</h3>
        {acciones}
      </div>
      <div className="chart-panel__body">{children}</div>
    </div>
  );
}

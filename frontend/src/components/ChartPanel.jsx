import "./ChartPanel.css";

export default function ChartPanel({ title, children, span = 1 }) {
  return (
    <div className="chart-panel" style={{ gridColumn: `span ${span}` }}>
      <h3 className="chart-panel__title">{title}</h3>
      <div className="chart-panel__body">{children}</div>
    </div>
  );
}

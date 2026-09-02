import "./BigNumberCard.css";

export default function BigNumberCard({ label, value, accent = "primario" }) {
  return (
    <div className="big-number-card" style={{ borderBottomColor: `var(--color-${accent})` }}>
      <span className="big-number-card__value">{value}</span>
      <span className="big-number-card__label">{label}</span>
    </div>
  );
}

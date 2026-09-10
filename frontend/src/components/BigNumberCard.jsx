import NotaInfo from "./NotaInfo";
import "./BigNumberCard.css";

/**
 * Número grande de la Vista Estratégica.
 *
 * `valor` en null significa "no se puede calcular", que NO es lo mismo que
 * cero. Cero es un resultado medido; null es un hueco de datos. Mostrar cero
 * en ese caso convierte la ausencia en una afirmación —"0 beneficiarios
 * atendidos"— que es falsa y que alguien puede terminar citando en un informe.
 *
 * `faltante` explica qué hace falta para calcularlo. Sin esa explicación, un
 * "Sin dato" parece que el tablero está roto; con ella, es una lista de
 * pendientes: dice qué archivo falta y a quién pedírselo.
 */
export default function BigNumberCard({ label, value, faltante, accent = "primario" }) {
  const sinDato = value === null || value === undefined;

  return (
    <div
      className="big-number-card"
      // El acento de color se apaga cuando no hay dato: un borde verde bajo un
      // hueco sugiere que algo salió bien.
      style={{ borderBottomColor: sinDato ? "var(--color-borde)" : `var(--color-${accent})` }}
    >
      {sinDato ? (
        <span className="big-number-card__sin-dato">
          Sin dato
          {faltante && <NotaInfo etiqueta={`Por qué falta: ${label}`}>{faltante}</NotaInfo>}
        </span>
      ) : (
        <span className="big-number-card__value">{value}</span>
      )}
      <span className="big-number-card__label">{label}</span>
    </div>
  );
}

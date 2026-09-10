import NotaInfo from "./NotaInfo";
import "./AlertCard.css";

function getStatusColor(value, thresholds = { good: 80, warn: 60 }) {
  if (value >= thresholds.good) return "verde";
  if (value >= thresholds.warn) return "advertencia";
  return "peligro";
}

export function AlertRing({ label, value, faltante }) {
  // null no es cero. Cero significa "medimos y ninguna cumple"; null, "no
  // tenemos con qué medirlo". Pintar cero en ese caso afirma algo falso.
  if (value === null || value === undefined) {
    return (
      <div className="alert-card alert-card--sin-dato">
        <span className="alert-card__sin-dato">
          Sin dato
          {faltante && <NotaInfo etiqueta={`Por qué falta: ${label}`}>{faltante}</NotaInfo>}
        </span>
        <p className="alert-card__label">{label}</p>
      </div>
    );
  }

  const color = getStatusColor(value);
  const circumference = 2 * Math.PI * 36;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className={`alert-card alert-card--${color}`}>
      <div className="alert-card__ring">
        {/* Decorativo: el porcentaje ya se anuncia como texto abajo. */}
        <svg width="88" height="88" viewBox="0 0 88 88" aria-hidden="true">
          <circle cx="44" cy="44" r="36" fill="none" stroke="var(--color-borde)" strokeWidth="8" />
          <circle
            cx="44" cy="44" r="36" fill="none"
            stroke={`var(--color-${color === "advertencia" ? "advertencia" : color})`}
            strokeWidth="8" strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 44 44)"
          />
        </svg>
        <span className="alert-card__ring-value">{value}%</span>
      </div>
      <p className="alert-card__label">{label}</p>
    </div>
  );
}

export function AlertBar({ label, value, pie }) {
  const color = getStatusColor(value);
  return (
    <div className={`alert-card alert-card--${color}`}>
      <p className="alert-card__label">{label}</p>
      <div className="alert-card__bar-track">
        <div
          className="alert-card__bar-fill"
          style={{ width: `${value}%`, backgroundColor: `var(--color-${color === "advertencia" ? "advertencia" : color})` }}
        />
      </div>
      <span className="alert-card__bar-value">{value}%</span>
      {/* El conteo acompaña al porcentaje porque el denominador es enorme:
          los primeros documentos mueven la cifra tan poco que sin él parece
          que el sistema no los registró. */}
      {pie && <span className="alert-card__pie">{pie}</span>}
    </div>
  );
}

export function AlertNumber({ label, value }) {
  return (
    <div className="alert-card alert-card--peligro">
      <div className="alert-card__number-row">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
            stroke="var(--color-peligro)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="alert-card__number">{value}</span>
      </div>
      <p className="alert-card__label">{label}</p>
    </div>
  );
}

/**
 * Resultado de la revisión: dos números en una sola tarjeta.
 *
 * Van juntos y no en dos tarjetas porque solo significan algo comparados: 12
 * aceptadas es una noticia distinta si hay 1 rechazada o si hay 40.
 */
export function AlertRevision({ label, aceptadas, denegadas }) {
  return (
    <div className="alert-card alert-card--verde">
      <p className="alert-card__label">{label}</p>
      <div className="alert-card__par">
        <div className="alert-card__par-lado">
          <span className="alert-card__par-valor alert-card__par-valor--verde">
            {aceptadas.toLocaleString("es-MX")}
          </span>
          <span className="alert-card__par-etiqueta">Aceptadas</span>
        </div>
        <div className="alert-card__par-lado">
          <span className="alert-card__par-valor alert-card__par-valor--peligro">
            {denegadas.toLocaleString("es-MX")}
          </span>
          <span className="alert-card__par-etiqueta">Denegadas</span>
        </div>
      </div>
    </div>
  );
}

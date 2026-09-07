import "./PillsMapa.css";

/**
 * Alternador entre los dos mapas.
 *
 * Se usan pastillas y no pestañas porque no son dos secciones distintas del
 * tablero: son dos formas de ver lo mismo, y ninguna sustituye a la otra. El
 * de calor responde "¿dónde se concentran?" y el de ubicaciones "¿dónde está
 * exactamente esta?".
 */
export default function PillsMapa({ valor, onCambiar, opciones }) {
  return (
    <div className="pills" role="tablist" aria-label="Tipo de mapa">
      {opciones.map((o) => (
        <button
          key={o.valor}
          type="button"
          role="tab"
          aria-selected={valor === o.valor}
          className={valor === o.valor ? "pills__item pills__item--activo" : "pills__item"}
          onClick={() => onCambiar(o.valor)}
        >
          {o.etiqueta}
        </button>
      ))}
    </div>
  );
}

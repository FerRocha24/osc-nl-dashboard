import "./EstadoPanel.css";

// Estados compartidos por todos los paneles que cargan datos del backend.
// Se separan en un componente para que las gráficas vacías no se vean como
// un error, y para que un backend caído se explique en vez de quedar en blanco.

export function Cargando({ alto = 220 }) {
  return (
    <div className="estado-panel" style={{ minHeight: alto }}>
      <div className="estado-panel__spinner" />
      <p className="estado-panel__texto">Cargando…</p>
    </div>
  );
}

export function ErrorPanel({ mensaje, onReintentar, alto = 220 }) {
  return (
    <div className="estado-panel estado-panel--error" style={{ minHeight: alto }}>
      <p className="estado-panel__titulo">No se pudieron cargar los datos</p>
      <p className="estado-panel__texto">{mensaje}</p>
      {onReintentar && (
        <button type="button" className="estado-panel__boton" onClick={onReintentar}>
          Reintentar
        </button>
      )}
    </div>
  );
}

// Para cuando la consulta sí funcionó pero no hay nada que graficar. Es el
// caso de las tablas que todavía no se han poblado (Beneficiarios,
// Fuente_Financiamiento), y conviene distinguirlo de un fallo real.
export function SinDatos({ mensaje = "Aún no hay datos para mostrar.", alto = 220 }) {
  return (
    <div className="estado-panel" style={{ minHeight: alto }}>
      <p className="estado-panel__texto">{mensaje}</p>
    </div>
  );
}

/**
 * Envuelve el contenido de un panel y decide qué mostrar según el estado de
 * la petición. `vacio` permite que cada panel defina qué cuenta como "sin
 * datos" (un arreglo de longitud 0, una suma en cero, etc.).
 */
export default function Estado({ cargando, error, onReintentar, vacio, mensajeVacio, alto, children }) {
  if (cargando) return <Cargando alto={alto} />;
  if (error) return <ErrorPanel mensaje={error} onReintentar={onReintentar} alto={alto} />;
  if (vacio) return <SinDatos mensaje={mensajeVacio} alto={alto} />;
  return children;
}

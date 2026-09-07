import { useEffect } from "react";
import { useApi } from "../api/client";
import Estado from "./EstadoPanel";
import Expediente from "./Expediente";
import ResolucionOsc from "./ResolucionOsc";
import "./OscDetalle.css";

function Campo({ etiqueta, children }) {
  if (children === null || children === undefined || children === "" ) return null;
  return (
    <div className="detalle__campo">
      <dt>{etiqueta}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function formatearFecha(valor) {
  if (!valor) return null;
  const [a, m, d] = valor.split("-").map(Number);
  if (!a || !m || !d) return null;
  return new Date(a, m - 1, d).toLocaleDateString("es-MX", {
    day: "2-digit", month: "long", year: "numeric",
  });
}

export default function OscDetalle({ idOsc, onCerrar }) {
  const { datos, cargando, error, recargar } = useApi("osc-detalle.php", { id: idOsc });

  // Escape cierra el panel, y mientras está abierto se bloquea el scroll del
  // fondo para que la rueda del ratón mueva la ficha y no la tabla de atrás.
  useEffect(() => {
    const alPresionar = (e) => {
      if (e.key !== "Escape") return;
      // El visor de documentos y la ventana de cambio de contraseña se montan
      // encima de esta ficha y también escuchan Escape. Sin esta guarda, una
      // sola pulsación cerraría los dos y la persona perdería la ficha por
      // querer cerrar lo de encima.
      if (document.querySelector(".visor, .cambiar")) return;
      onCerrar();
    };
    document.addEventListener("keydown", alPresionar);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alPresionar);
      document.body.style.overflow = overflowPrevio;
    };
  }, [onCerrar]);

  const osc = datos?.osc;
  const apoyos = datos?.apoyos ?? [];

  return (
    <div className="detalle__fondo" onClick={onCerrar}>
      {/* El clic dentro del panel no debe cerrarlo. */}
      <aside
        className="detalle"
        role="dialog"
        aria-modal="true"
        aria-label="Ficha de la organización"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="detalle__encabezado">
          <div>
            <p className="detalle__folio">{osc?.no_registro ? `Folio ${osc.no_registro}` : "Ficha"}</p>
            <h2 className="detalle__titulo">{osc?.razon_social ?? "Cargando…"}</h2>
          </div>
          <button type="button" className="detalle__cerrar" onClick={onCerrar} aria-label="Cerrar ficha">
            ✕
          </button>
        </header>

        <div className="detalle__cuerpo">
          <Estado cargando={cargando} error={error} onReintentar={recargar} alto={200}>
            {osc && (
              <>
                <section className="detalle__seccion">
                  <h3>Identificación</h3>
                  <dl className="detalle__lista">
                    <Campo etiqueta="Alias">{osc.alias}</Campo>
                    <Campo etiqueta="Categoría">{osc.categoria}</Campo>
                    <Campo etiqueta="Rubro específico">{osc.rubro}</Campo>
                    <Campo etiqueta="Municipio">{osc.municipio}</Campo>
                    <Campo etiqueta="RFC">{osc.rfc}</Campo>
                    <Campo etiqueta="Fecha de registro">{formatearFecha(osc.fecha_registro)}</Campo>
                    <Campo etiqueta="Estatus documental">{osc.estatus_documental}</Campo>
                  </dl>
                </section>

                <section className="detalle__seccion">
                  <h3>Contacto</h3>
                  <dl className="detalle__lista">
                    <Campo etiqueta="Dirección">{osc.direccion}</Campo>
                    <Campo etiqueta="Teléfono">{osc.telefono}</Campo>
                    <Campo etiqueta="Correos">
                      {osc.correos?.length ? (
                        <ul className="detalle__correos">
                          {osc.correos.map((c) => (
                            <li key={c}><a href={`mailto:${c}`}>{c}</a></li>
                          ))}
                        </ul>
                      ) : null}
                    </Campo>
                    <Campo etiqueta="Sitio web">{osc.sitio_web}</Campo>
                    <Campo etiqueta="Persona de contacto">{osc.nombre_contacto}</Campo>
                    <Campo etiqueta="Preside">{osc.nombre_presidente}</Campo>
                  </dl>
                </section>

                {(osc.mision || osc.actividad_principal) && (
                  <section className="detalle__seccion">
                    <h3>Qué hace</h3>
                    {osc.mision && (
                      <>
                        <p className="detalle__subtitulo">Misión</p>
                        <p className="detalle__texto">{osc.mision}</p>
                      </>
                    )}
                    {osc.actividad_principal && (
                      <>
                        <p className="detalle__subtitulo">Actividad principal</p>
                        <p className="detalle__texto">{osc.actividad_principal}</p>
                      </>
                    )}
                  </section>
                )}

                {/* La resolución va ANTES del expediente: es la conclusión, y
                    quien abre la ficha quiere saber primero en qué quedó. */}
                <section className="detalle__seccion">
                  <ResolucionOsc osc={osc} onResuelto={recargar} />
                </section>

                <section className="detalle__seccion">
                  <Expediente idOsc={osc.id_osc} />
                </section>

                <section className="detalle__seccion">
                  <h3>
                    Apoyos recibidos
                    <span className="detalle__conteo">{apoyos.length}</span>
                  </h3>
                  {apoyos.length === 0 ? (
                    <p className="detalle__vacio">
                      Esta organización no aparece en el historial de inversión social 2023-2024.
                    </p>
                  ) : (
                    <ul className="detalle__apoyos">
                      {apoyos.map((a) => (
                        <li key={a.id_apoyo} className="detalle__apoyo">
                          <div className="detalle__apoyo-encabezado">
                            <span className="detalle__anio">{a.anio}</span>
                            <span className="detalle__tipo">{a.tipo}</span>
                          </div>
                          <p className="detalle__poblacion">Población: {a.poblacion}</p>
                          {a.linea_accion && <p className="detalle__texto">{a.linea_accion}</p>}
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </>
            )}
          </Estado>
        </div>
      </aside>
    </div>
  );
}

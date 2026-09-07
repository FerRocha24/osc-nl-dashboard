import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useApi } from "../api/client";
import Estado from "./EstadoPanel";
import NotaInfo from "./NotaInfo";
import { CLASE_OPERACION } from "./estatusDocumental";
import "./MapaUbicaciones.css";

// Nuevo León completo, para cuando no hay ningún punto que encuadrar.
const VISTA_ESTADO = { centro: [25.4, -100.1], zoom: 7 };

// Los colores se leen del CSS y no se escriben aquí: el mapa usa el mismo
// código de color que los badges de la tabla, y tenerlo en dos lados llevaría
// a que un día dejen de coincidir.
const COLOR = {
  verde: "#3FA383",
  advertencia: "#D98E04",
  peligro: "#C0392B",
  neutro: "#6B6259",
};

function escapar(texto) {
  return String(texto ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/**
 * Mapa de ubicaciones: un punto por organización.
 *
 * Complementa el mapa de calor, no lo sustituye. El de calor responde "¿dónde
 * se concentran?" y este "¿dónde está exactamente esta?", que es lo que hace
 * falta para una visita domiciliaria.
 *
 * Las coordenadas salen del padrón —las capturó la Secretaría en campo—, no de
 * un geocodificador. Se probó Nominatim y de 10 direcciones solo 6 caían en el
 * municipio correcto: un mapa donde 4 de cada 10 puntos están mal es peor que
 * no tener mapa, porque nadie sabe cuáles son.
 */
export default function MapaUbicaciones({ filtros, onSeleccionar }) {
  const { datos, cargando, error, recargar } = useApi("osc-ubicaciones.php", filtros);
  const mapa = useRef(null);
  const capa = useRef(null);
  // Sirve para volver a dibujar los puntos cuando el mapa nace DESPUÉS de que
  // llegaron los datos, que es el caso normal.
  const [listo, setListo] = useState(false);

  // useMemo y no `datos?.puntos ?? []` directo: ese literal es un array nuevo
  // en cada render, y el efecto de abajo lo tiene como dependencia. Sin esto
  // borraba y volvía a dibujar los cientos de marcadores continuamente, y el
  // fitBounds peleaba con el zoom que la persona acabara de hacer.
  const puntos = useMemo(() => datos?.puntos ?? [], [datos]);

  // Ref de callback y no useRef con un efecto de montaje.
  //
  // El <div> del mapa vive dentro de <Estado>, que mientras carga muestra
  // "Cargando…" y no lo monta. Un efecto con dependencias vacías corría antes
  // de que el div existiera, encontraba la referencia en null, se salía, y no
  // se volvía a ejecutar nunca: el mapa jamás se creaba. La ref de callback se
  // dispara justo cuando el nodo entra al DOM, y otra vez con null al salir.
  const montarLienzo = useCallback((nodo) => {
    if (nodo === null) {
      mapa.current?.remove();
      mapa.current = null;
      capa.current = null;
      setListo(false);
      return;
    }
    if (mapa.current) return;

    mapa.current = L.map(nodo, {
      center: VISTA_ESTADO.centro,
      zoom: VISTA_ESTADO.zoom,
      // El scroll de la rueda se activa solo al hacer clic: si no, bajar por
      // la página con el ratón encima del mapa hace zoom en vez de desplazar.
      scrollWheelZoom: false,
    });
    mapa.current.on("click", () => mapa.current.scrollWheelZoom.enable());
    mapa.current.on("mouseout", () => mapa.current.scrollWheelZoom.disable());

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      // La atribución es obligatoria por la licencia de OpenStreetMap.
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(mapa.current);

    capa.current = L.layerGroup().addTo(mapa.current);
    setListo(true);
  }, []);

  // Los puntos sí se redibujan cuando cambian los filtros.
  useEffect(() => {
    if (!mapa.current || !capa.current) return;
    capa.current.clearLayers();
    if (puntos.length === 0) {
      mapa.current.setView(VISTA_ESTADO.centro, VISTA_ESTADO.zoom);
      return;
    }

    // Varias OSC caen en la misma coordenada: comparten domicilio, o el
    // geocodificador devolvió el centro de la calle. Hay un punto con 11.
    // Apiladas, solo se podría abrir la de encima; y separarlas moviéndolas
    // unos metros sería inventar posiciones. Se dibuja un marcador y su
    // ventana las lista todas.
    const grupos = new Map();
    for (const p of puntos) {
      const clave = `${p.latitud},${p.longitud}`;
      if (!grupos.has(clave)) grupos.set(clave, []);
      grupos.get(clave).push(p);
    }

    for (const grupo of grupos.values()) {
      const p = grupo[0];
      // Con estatus mezclados en el mismo punto, ningún color sería honesto.
      const clases = new Set(grupo.map((x) => CLASE_OPERACION[x.estatus_operacion] ?? "neutro"));
      const color = COLOR[clases.size === 1 ? [...clases][0] : "neutro"];
      // Las dos clases de coordenada NO se dibujan igual. La del padrón es el
      // domicilio verificado; la aproximada se calculó de la dirección escrita
      // y cae en la cuadra, no en la puerta. Si se vieran idénticas, alguien
      // saldría a una visita con una estimación creyendo que fue verificada.
      const aproximada = grupo.some((x) => x.origen_coordenada === "aproximada");
      const marcador = L.circleMarker([p.latitud, p.longitud], {
        // Un punto con varias crece un poco, para que se note que ahí hay más
        // de una antes de abrirlo.
        radius: grupo.length > 1 ? 8 : 6,
        color: aproximada ? color : "#fff",
        weight: aproximada ? 2 : 1.5,
        dashArray: aproximada ? "2 2" : undefined,
        fillColor: color,
        fillOpacity: aproximada ? 0.25 : 0.85,
      });
      const aviso = aproximada
        ? '<span class="mapa-pop__aprox">Ubicación aproximada, calculada de la dirección</span>'
        : "";

      marcador.bindPopup(
        grupo.length === 1
          ? `<strong>${escapar(p.razon_social)}</strong><br>
             <span class="mapa-pop__meta">Folio ${escapar(p.no_registro ?? "—")} ·
             ${escapar(p.municipio ?? "Sin municipio")}</span><br>
             <span class="mapa-pop__meta">${escapar(p.estatus_operacion ?? "Sin dato de operación")}</span>
             ${aviso}`
          : `<strong>${grupo.length} organizaciones en esta ubicación</strong><br>
             <span class="mapa-pop__meta">${escapar(p.municipio ?? "Sin municipio")}</span>
             <ul class="mapa-pop__lista">
               ${grupo.map((x) => `<li>${escapar(x.razon_social)}</li>`).join("")}
             </ul>
             ${aviso}`
      );
      if (onSeleccionar && grupo.length === 1) {
        marcador.on("popupopen", () => {
          const nodo = marcador.getPopup().getElement();
          const boton = document.createElement("button");
          boton.type = "button";
          boton.className = "mapa-pop__boton";
          boton.textContent = "Ver ficha";
          boton.onclick = () => onSeleccionar(p.id_osc);
          nodo.querySelector(".leaflet-popup-content").appendChild(boton);
        });
      }
      marcador.addTo(capa.current);
    }

    // Encuadre automático: con un filtro de municipio, ver todo el estado
    // dejaría los puntos como un manchón en una esquina.
    const limites = L.latLngBounds(puntos.map((p) => [p.latitud, p.longitud]));
    mapa.current.fitBounds(limites, { padding: [28, 28], maxZoom: 14 });
  }, [listo, puntos, onSeleccionar]);

  const sinCoordenadas = !cargando && !error && puntos.length === 0;
  const total = datos?.total ?? 0;
  const aproximadas = puntos.filter((p) => p.origen_coordenada === "aproximada").length;

  return (
    <div className="mapa-ubi">
      <Estado cargando={cargando} error={error} onReintentar={recargar} alto={320}>
        <>
          {/* El contenedor se mantiene montado aunque no haya puntos: Leaflet
              necesita el nodo para existir, y desmontarlo obligaría a recrear
              el mapa cada vez que un filtro se queda sin resultados. */}
          <div className="mapa-ubi__lienzo" ref={montarLienzo}>
            {/* La cuenta va encima del mapa y el porqué detrás del signo: un
                párrafo fijo debajo se deja de leer a la tercera vez, pero la
                cifra sí hace falta a la vista para no creer que faltan puntos
                por un error. */}
            <div className="mapa-ubi__aviso">
              <span>
                {sinCoordenadas
                  ? "Sin ubicaciones"
                  : `${puntos.length.toLocaleString("es-MX")} de ${total.toLocaleString("es-MX")}`}
              </span>
              <NotaInfo etiqueta="Por qué faltan ubicaciones">
                {sinCoordenadas ? (
                  <>
                    Ninguna organización tiene coordenadas todavía. Las trae el
                    padrón de la Secretaría en las columnas <code>latitud</code>{" "}
                    y <code>longitud</code>, y se llenan al importar el archivo
                    completo.
                  </>
                ) : (
                  <>
                    Faltan {(total - puntos.length).toLocaleString("es-MX")}{" "}
                    organizaciones sin ubicación que se pueda situar en el mapa.
                    {aproximadas > 0 && (
                      <>
                        {" "}De las dibujadas,{" "}
                        <strong>{aproximadas.toLocaleString("es-MX")}</strong>{" "}
                        son <strong>aproximadas</strong> (círculo hueco):
                        se calcularon de la dirección escrita, así que caen en
                        la cuadra correcta pero no son el domicilio verificado.
                        Se comprobó que cada una quedara dentro de su municipio;
                        las que no, se descartaron.
                      </>
                    )}
                  </>
                )}
              </NotaInfo>
            </div>
          </div>
        </>
      </Estado>
    </div>
  );
}

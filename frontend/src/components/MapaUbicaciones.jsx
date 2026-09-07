import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useApi } from "../api/client";
import Estado from "./EstadoPanel";
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
  const contenedor = useRef(null);
  const mapa = useRef(null);
  const capa = useRef(null);

  // useMemo y no `datos?.puntos ?? []` directo: ese literal es un array nuevo
  // en cada render, y el efecto de abajo lo tiene como dependencia. Sin esto
  // borraba y volvía a dibujar los cientos de marcadores continuamente, y el
  // fitBounds peleaba con el zoom que la persona acabara de hacer.
  const puntos = useMemo(() => datos?.puntos ?? [], [datos]);

  // El mapa se crea una sola vez. Leaflet maneja su propio DOM, así que
  // recrearlo en cada render perdería el zoom y la posición de la persona.
  useEffect(() => {
    if (mapa.current || !contenedor.current) return;

    mapa.current = L.map(contenedor.current, {
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

    return () => {
      mapa.current?.remove();
      mapa.current = null;
    };
  }, []);

  // Los puntos sí se redibujan cuando cambian los filtros.
  useEffect(() => {
    if (!mapa.current || !capa.current) return;
    capa.current.clearLayers();
    if (puntos.length === 0) {
      mapa.current.setView(VISTA_ESTADO.centro, VISTA_ESTADO.zoom);
      return;
    }

    for (const p of puntos) {
      const color = COLOR[CLASE_OPERACION[p.estatus_operacion] ?? "neutro"];
      const marcador = L.circleMarker([p.latitud, p.longitud], {
        radius: 6,
        color: "#fff",
        weight: 1.5,
        fillColor: color,
        fillOpacity: 0.85,
      });
      marcador.bindPopup(`
        <strong>${escapar(p.razon_social)}</strong><br>
        <span class="mapa-pop__meta">Folio ${escapar(p.no_registro ?? "—")} ·
        ${escapar(p.municipio ?? "Sin municipio")}</span><br>
        <span class="mapa-pop__meta">${escapar(p.estatus_operacion ?? "Sin dato de operación")}</span>
      `);
      if (onSeleccionar) {
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
  }, [puntos, onSeleccionar]);

  const sinCoordenadas = !cargando && !error && puntos.length === 0;

  return (
    <div className="mapa-ubi">
      <Estado cargando={cargando} error={error} onReintentar={recargar} alto={320}>
        <>
          {/* El contenedor se mantiene montado aunque no haya puntos: Leaflet
              necesita el nodo para existir, y desmontarlo obligaría a recrear
              el mapa cada vez que un filtro se queda sin resultados. */}
          <div className="mapa-ubi__lienzo" ref={contenedor} />

          {sinCoordenadas ? (
            <p className="mapa-ubi__vacio">
              Ninguna organización tiene coordenadas todavía. Las trae el padrón
              de la Secretaría en las columnas <code>latitud</code> y{" "}
              <code>longitud</code>; se llenan al importar el archivo completo.
            </p>
          ) : (
            <p className="mapa-ubi__pie">
              Se muestran {puntos.length.toLocaleString("es-MX")} de{" "}
              {(datos?.total ?? 0).toLocaleString("es-MX")} organizaciones.
              El resto todavía no tiene coordenada en el padrón.
            </p>
          )}
        </>
      </Estado>
    </div>
  );
}

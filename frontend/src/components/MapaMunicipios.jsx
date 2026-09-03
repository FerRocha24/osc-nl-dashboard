import { useEffect, useMemo, useState } from "react";
import Estado from "./EstadoPanel";
import "./MapaMunicipios.css";

// Mapa de calor de los 51 municipios de Nuevo León.
//
// Se dibuja como SVG plano, sin librería de mapas. Leaflet o react-simple-maps
// pesan cientos de KB y además Leaflet pediría mosaicos a un servidor externo;
// aquí solo hacen falta polígonos rellenos, y eso es una proyección y un
// <path>. El GeoJSON (43 KB, simplificado con Douglas-Peucker) se pide como
// archivo estático, así que no entra al bundle de JavaScript.
//
// NOTA: no hay coordenadas por organización en la base — solo el municipio —
// así que el mapa llega al nivel municipal, no a puntos por OSC.

const RUTA_GEOJSON = "/nuevo-leon-municipios.json";

// Normaliza para cruzar los nombres del GeoJSON con los de la base, que
// difieren en acentos, mayúsculas y artículos ("Aldamas, Los" vs "Los Aldamas").
function normalizar(nombre) {
  return (nombre ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/^(los|las|el|la)\s+/, "")
    .replace(/,\s*(los|las|el|la)$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Proyecta longitud/latitud a coordenadas del SVG.
 *
 * Es una equirectangular ajustada a la caja: para un solo estado la distorsión
 * es imperceptible y evita traer d3-geo. El factor cos(latitud) corrige que un
 * grado de longitud mide menos que uno de latitud, sin él Nuevo León saldría
 * estirado a lo ancho.
 */
function crearProyeccion(features, ancho, alto, margen = 8) {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const f of features) {
    for (const anillo of aplanarAnillos(f.geometry)) {
      for (const [x, y] of anillo) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  const latMedia = ((minY + maxY) / 2) * Math.PI / 180;
  const factorX = Math.cos(latMedia);

  const anchoGeo = (maxX - minX) * factorX;
  const altoGeo = maxY - minY;
  const escala = Math.min((ancho - margen * 2) / anchoGeo, (alto - margen * 2) / altoGeo);

  const desplX = (ancho - anchoGeo * escala) / 2;
  const desplY = (alto - altoGeo * escala) / 2;

  return ([lon, lat]) => [
    desplX + (lon - minX) * factorX * escala,
    // La latitud crece hacia el norte y la Y del SVG hacia abajo: se invierte.
    desplY + (maxY - lat) * escala,
  ];
}

function aplanarAnillos(geometria) {
  if (!geometria) return [];
  return geometria.type === "Polygon"
    ? geometria.coordinates
    : geometria.coordinates.flat();
}

function construirRuta(geometria, proyectar) {
  return aplanarAnillos(geometria)
    .map((anillo) => {
      const puntos = anillo.map(proyectar);
      if (puntos.length < 2) return "";
      return "M" + puntos.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L") + "Z";
    })
    .join(" ");
}

// Escala de color secuencial sobre el naranja de la marca. Se usa la raíz
// cuadrada y no una escala lineal porque Monterrey (427) aplasta a todos los
// demás: con escala lineal, municipios con 10 o 50 OSC se verían iguales.
function color(total, maximo) {
  if (!total) return "var(--color-fondo)";
  const t = Math.sqrt(total) / Math.sqrt(maximo);
  const claro = [244, 227, 208];
  const oscuro = [156, 81, 8];
  const c = claro.map((v, i) => Math.round(v + (oscuro[i] - v) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

const ANCHO = 560;
const ALTO = 420;

export default function MapaMunicipios({ datos = [], cargando, error, onReintentar, onSeleccionar }) {
  const [geo, setGeo] = useState(null);
  const [errorGeo, setErrorGeo] = useState(null);
  const [encima, setEncima] = useState(null);

  useEffect(() => {
    let vigente = true;
    fetch(RUTA_GEOJSON)
      .then((r) => {
        if (!r.ok) throw new Error(`No se pudo cargar el mapa (HTTP ${r.status}).`);
        return r.json();
      })
      .then((j) => { if (vigente) setGeo(j); })
      .catch((e) => { if (vigente) setErrorGeo(e.message); });
    return () => { vigente = false; };
  }, []);

  const porMunicipio = useMemo(() => {
    const m = new Map();
    for (const d of datos) m.set(normalizar(d.municipio), d);
    return m;
  }, [datos]);

  const maximo = useMemo(
    () => datos.reduce((mx, d) => Math.max(mx, d.total), 0) || 1,
    [datos]
  );

  const formas = useMemo(() => {
    if (!geo) return [];
    const proyectar = crearProyeccion(geo.features, ANCHO, ALTO);
    return geo.features.map((f) => {
      const nombreGeo = f.properties.municipio;
      const dato = porMunicipio.get(normalizar(nombreGeo));
      return {
        nombreGeo,
        // Se prefiere el nombre de la base: es el que usan los filtros.
        nombre: dato?.municipio ?? nombreGeo,
        total: dato?.total ?? 0,
        seleccionable: Boolean(dato),
        d: construirRuta(f.geometry, proyectar),
      };
    });
  }, [geo, porMunicipio]);

  return (
    <Estado
      cargando={cargando || (!geo && !errorGeo)}
      error={error ?? errorGeo}
      onReintentar={onReintentar}
      vacio={Boolean(geo) && datos.length === 0}
      mensajeVacio="Ningún municipio coincide con los filtros seleccionados."
      alto={ALTO}
    >
      <div className="mapa">
        <svg
          viewBox={`0 0 ${ANCHO} ${ALTO}`}
          className="mapa__svg"
          role="img"
          aria-label={`Mapa de Nuevo León con la cantidad de organizaciones por municipio. Máximo: ${maximo}.`}
        >
          {formas.map((f) => (
            <path
              key={f.nombreGeo}
              d={f.d}
              fill={color(f.total, maximo)}
              stroke="var(--color-superficie)"
              strokeWidth="0.7"
              className={f.seleccionable ? "mapa__municipio mapa__municipio--activo" : "mapa__municipio"}
              onMouseEnter={() => setEncima(f)}
              onMouseLeave={() => setEncima(null)}
              onClick={() => f.seleccionable && onSeleccionar?.(f.nombre)}
            >
              <title>{`${f.nombre}: ${f.total} ${f.total === 1 ? "organización" : "organizaciones"}`}</title>
            </path>
          ))}
        </svg>

        <div className="mapa__pie">
          <div className="mapa__leyenda" aria-hidden="true">
            <span>0</span>
            <span className="mapa__gradiente" />
            <span>{maximo}</span>
          </div>
          <p className="mapa__detalle">
            {encima
              ? `${encima.nombre}: ${encima.total} ${encima.total === 1 ? "organización" : "organizaciones"}`
              : "Pasa el cursor por un municipio; haz clic para filtrar"}
          </p>
        </div>
      </div>
    </Estado>
  );
}

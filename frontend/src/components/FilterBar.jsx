import { useEffect, useState } from "react";
import { useApi } from "../api/client";
import { obtenerSesion } from "../api/auth";
import {
  ESTATUS_DOCUMENTAL, RESOLUCIONES, ETIQUETA_RESOLUCION, ESTATUS_OPERACION,
} from "./estatusDocumental";
import "./FilterBar.css";

// Las opciones se piden a filtros.php, que las saca de
// los municipios, rubros y categorías que realmente existen en la base.
//
// El componente es controlado y configurable: cada vista declara qué campos
// necesita. La Operativa filtra el padrón (municipio, rubro, estatus); la
// Estratégica filtra agregados, donde el rubro específico y el estatus
// documental no significan nada, pero la categoría sí.

const OPCIONES_INICIALES = {
  municipios: ["Todos"],
  rubros: ["Todos"],
  categorias: ["Todos"],
  estatus: ["Todos", ...ESTATUS_DOCUMENTAL],
  resoluciones: ["Todos", ...RESOLUCIONES],
  operaciones: ["Todos", ...ESTATUS_OPERACION],
};

const CAMPOS = {
  municipio: { etiqueta: "Municipio", lista: (o) => o.municipios },
  rubro:     { etiqueta: "Rubro", lista: (o) => o.rubros },
  categoria: { etiqueta: "Categoría", lista: (o) => o.categorias },
  estatus:   { etiqueta: "Expediente", lista: (o) => o.estatus },
  resolucion: {
    etiqueta: "Resolución",
    // El texto cambia pero el valor no: el backend sigue esperando "Pendiente".
    opciones: () => [
      { valor: "Todos", etiqueta: "Todos" },
      ...RESOLUCIONES.map((r) => ({ valor: r, etiqueta: ETIQUETA_RESOLUCION[r] ?? r })),
    ],
  },
  operacion: { etiqueta: "Operación", lista: (o) => o.operaciones },
  // Este no viene del backend: son dos preguntas fijas ("¿qué me toca?" y
  // "¿qué está sin repartir?"), y no hace falta listar a todo el personal.
  asignado: {
    etiqueta: "Responsable",
    lista: () => ["Todos", "sin"],
    // El id de la sesión se resuelve al vuelo: el valor guardado en el filtro
    // tiene que ser el id real, para que el backend lo entienda.
    opciones: (sesion) => [
      { valor: "Todos", etiqueta: "Todos" },
      { valor: "sin", etiqueta: "Sin asignar" },
      ...(sesion?.id ? [{ valor: String(sesion.id), etiqueta: "Asignadas a mí" }] : []),
    ],
  },
};

/**
 * Campo de búsqueda por nombre.
 *
 * Va con estado propio y no directo al filtro: escribir dispararía una
 * consulta por letra —"fundación" son nueve— y cada una recorre las 779
 * organizaciones. Se espera a que la persona deje de teclear.
 */
function Busqueda({ valor, onBuscar, deshabilitado }) {
  const [texto, setTexto] = useState(valor ?? "");

  // Si el filtro se limpia desde fuera (el botón "Limpiar"), el campo también.
  // Se ajusta comparando durante el render y no con un efecto: un efecto que
  // llama a setState provoca un render extra en cascada, y React recomienda
  // este patrón justo para adaptar estado a un cambio de prop.
  const [valorPrevio, setValorPrevio] = useState(valor);
  if (valor !== valorPrevio) {
    setValorPrevio(valor);
    setTexto(valor ?? "");
  }

  useEffect(() => {
    if (texto === (valor ?? "")) return;
    const id = setTimeout(() => onBuscar(texto), 350);
    return () => clearTimeout(id);
  }, [texto, valor, onBuscar]);

  return (
    <div className="filter-bar__group filter-bar__group--busqueda">
      <label className="filter-bar__label" htmlFor="filtro-q">Buscar</label>
      <div className="filter-bar__buscador">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
          <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <input
          id="filtro-q"
          type="search"
          className="filter-bar__input"
          placeholder="Nombre, siglas o RFC"
          value={texto}
          disabled={deshabilitado}
          onChange={(e) => setTexto(e.target.value)}
          // Enter busca de inmediato, sin esperar la pausa.
          onKeyDown={(e) => { if (e.key === "Enter") onBuscar(texto); }}
        />
        {texto !== "" && (
          <button
            type="button"
            className="filter-bar__limpiar-busqueda"
            aria-label="Limpiar la búsqueda"
            onClick={() => { setTexto(""); onBuscar(""); }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}

export default function FilterBar({
  campos = ["municipio", "rubro", "estatus"],
  valores,
  onChange,
  onBuscar,
  busqueda,
  mostrarFechas = true,
}) {
  const { datos, cargando } = useApi("filtros.php", {}, OPCIONES_INICIALES);
  const opciones = datos ?? OPCIONES_INICIALES;

  const esControlado = typeof onChange === "function";

  const cambiar = (campo) => (evento) => {
    if (esControlado) onChange({ ...valores, [campo]: evento.target.value });
  };

  const limpiar = () => {
    if (!esControlado) return;
    // La búsqueda se limpia con los demás: si quedara puesta, "Limpiar"
    // dejaría la tabla filtrada sin ningún control que lo explique.
    onChange({ ...Object.fromEntries(campos.map((c) => [c, "Todos"])), q: "" });
  };

  const hayFiltros = campos.some((c) => (valores?.[c] ?? "Todos") !== "Todos")
    || (valores?.q ?? "") !== "";

  return (
    <div className="filter-bar">
      {onBuscar && (
        <Busqueda valor={busqueda} onBuscar={onBuscar} deshabilitado={cargando} />
      )}

      {campos.map((campo) => {
        const def = CAMPOS[campo];
        if (!def) return null;
        // Un campo puede definir sus opciones con etiqueta propia, cuando el
        // valor que viaja al backend no es el texto que se lee en pantalla.
        const items = def.opciones
          ? def.opciones(obtenerSesion())
          : (def.lista(opciones) ?? ["Todos"]).map((v) => ({ valor: v, etiqueta: v }));
        return (
          <div className="filter-bar__group" key={campo}>
            <label className="filter-bar__label" htmlFor={`filtro-${campo}`}>
              {def.etiqueta}
            </label>
            <select
              id={`filtro-${campo}`}
              className="filter-bar__select"
              disabled={cargando}
              {...(esControlado
                ? { value: valores?.[campo] ?? "Todos", onChange: cambiar(campo) }
                : { defaultValue: "Todos" })}
            >
              {items.map((o) => (
                <option key={o.valor} value={o.valor}>{o.etiqueta}</option>
              ))}
            </select>
          </div>
        );
      })}

      {mostrarFechas && (
        <div className="filter-bar__group">
          <label className="filter-bar__label" htmlFor="filtro-fechas">Rango de fechas</label>
          {/* Sin conectar: las 779 OSC importadas traen fecha_registro en NULL,
              así que filtrar por fecha no devolvería nada todavía. */}
          <select id="filtro-fechas" className="filter-bar__select" defaultValue="Últimos 12 meses" disabled>
            <option>Últimos 30 días</option>
            <option>Últimos 3 meses</option>
            <option>Últimos 12 meses</option>
            <option>Año en curso</option>
          </select>
        </div>
      )}

      {esControlado && hayFiltros && (
        <button type="button" className="filter-bar__limpiar" onClick={limpiar}>
          Limpiar filtros
        </button>
      )}
    </div>
  );
}

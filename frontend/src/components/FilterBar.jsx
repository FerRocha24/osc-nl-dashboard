import { useApi } from "../api/client";
import "./FilterBar.css";

// Las opciones ya no vienen de mockData: se piden a filtros.php, que las
// saca de los municipios y rubros que realmente existen en la base.
//
// El componente es controlado: recibe los valores y avisa de los cambios,
// para que la página dueña de los datos vuelva a pedir la lista filtrada.
// Si no se le pasa `onChange` se comporta como antes (solo decorativo).

const OPCIONES_INICIALES = {
  municipios: ["Todos"],
  rubros: ["Todos"],
  estatus: ["Todos", "Completo", "Pendiente", "Vencido"],
};

export default function FilterBar({ valores, onChange, deshabilitado = false }) {
  const { datos, cargando } = useApi("filtros.php", {}, OPCIONES_INICIALES);
  const opciones = datos ?? OPCIONES_INICIALES;

  const esControlado = typeof onChange === "function";
  const bloqueado = deshabilitado || cargando;

  const cambiar = (campo) => (evento) => {
    if (esControlado) onChange({ ...valores, [campo]: evento.target.value });
  };

  const grupos = [
    { campo: "municipio", etiqueta: "Municipio", lista: opciones.municipios },
    { campo: "rubro", etiqueta: "Rubro", lista: opciones.rubros },
    { campo: "estatus", etiqueta: "Estatus", lista: opciones.estatus },
  ];

  return (
    <div className="filter-bar">
      {grupos.map(({ campo, etiqueta, lista }) => (
        <div className="filter-bar__group" key={campo}>
          <label className="filter-bar__label" htmlFor={`filtro-${campo}`}>
            {etiqueta}
          </label>
          <select
            id={`filtro-${campo}`}
            className="filter-bar__select"
            disabled={bloqueado}
            {...(esControlado
              ? { value: valores?.[campo] ?? "Todos", onChange: cambiar(campo) }
              : { defaultValue: "Todos" })}
          >
            {lista.map((opcion) => (
              <option key={opcion} value={opcion}>{opcion}</option>
            ))}
          </select>
        </div>
      ))}

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
    </div>
  );
}

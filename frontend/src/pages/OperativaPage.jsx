import { useState } from "react";
import Header from "../components/Header";
import FilterBar from "../components/FilterBar";
import { AlertRing, AlertBar, AlertNumber, AlertRevision } from "../components/AlertCard";
import OscTable from "../components/OscTable";
import Estado from "../components/EstadoPanel";
import OscDetalle from "../components/OscDetalle";
import AsignarLote from "../components/AsignarLote";
import { tieneRol } from "../api/auth";
import { pedirJson, useApi } from "../api/client";
import "./Pages.css";

const FILTROS_INICIALES = {
  municipio: "Todos", rubro: "Todos", operacion: "Todos",
  estatus: "Todos", resolucion: "Todos", asignado: "Todos",
};
const POR_PAGINA = 10;

export default function OperativaPage() {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [pagina, setPagina] = useState(1);
  // id de la OSC cuya ficha está abierta; null = panel cerrado
  const [oscSeleccionada, setOscSeleccionada] = useState(null);
  const [asignandoLote, setAsignandoLote] = useState(false);

  // Al cambiar un filtro se vuelve a la primera página: quedarse en la 8 tras
  // filtrar a 12 resultados dejaría la tabla vacía sin explicación.
  const cambiarFiltros = (nuevos) => {
    setFiltros(nuevos);
    setPagina(1);
  };

  const padron = useApi("osc.php", { ...filtros, pagina, limite: POR_PAGINA });

  // El reporte incluye TODAS las organizaciones que cumplen el filtro, no solo
  // la página visible: el backend tope 500 por petición, así que se recorre en
  // bloques hasta juntarlas.
  const exportacion = {
    nombre: "padron-osc",
    etiquetaCsv: "Exportar padrón filtrado",
    obtenerDatos: async () => {
      const POR_BLOQUE = 500;
      const filas = [];
      for (let p = 1; ; p++) {
        const bloque = await pedirJson("osc.php", { ...filtros, pagina: p, limite: POR_BLOQUE });
        filas.push(...bloque.osc);
        if (filas.length >= bloque.total || bloque.osc.length === 0) break;
      }
      return {
        columnas: [
          { clave: "no_registro", titulo: "Folio" },
          { clave: "razon_social", titulo: "Razón social" },
          { clave: "municipio", titulo: "Municipio" },
          { clave: "rubro", titulo: "Rubro" },
          { clave: "estatus_operacion", titulo: "Operación" },
          { clave: "estatus_documental", titulo: "Estatus documental" },
          { clave: "estatus_revision", titulo: "Resolución" },
          { clave: "asignado_a", titulo: "Responsable" },
          { clave: "ultima_actualizacion", titulo: "Última actualización" },
          { clave: "actividad_principal", titulo: "Actividad principal" },
        ],
        filas,
      };
    },
  };
  const kpis = useApi("kpis-operativos.php");


  return (
    <div className="page">
      <Header exportacion={exportacion} />
      <FilterBar
        campos={["municipio", "rubro", "operacion", "estatus", "resolucion", "asignado"]}
        valores={filtros}
        onChange={cambiarFiltros}
      />

      <main className="page__content">
        <section className="page__alerts">
          <Estado cargando={kpis.cargando} error={kpis.error} onReintentar={kpis.recargar} alto={140}>
            <>
              <AlertRing
                label="OSC con donataria vigente"
                value={kpis.datos?.porcentaje_donataria_vigente ?? 0}
              />
              <AlertBar
                label="Completitud documental promedio"
                value={kpis.datos?.porcentaje_completitud_documental ?? 0}
              />
              <AlertNumber
                label="OSC con documentación incompleta"
                value={(kpis.datos?.osc_documentacion_incompleta ?? 0).toLocaleString("es-MX")}
              />
              <AlertRevision
                label="Resultado de la revisión"
                aceptadas={kpis.datos?.osc_aceptadas ?? 0}
                denegadas={kpis.datos?.osc_denegadas ?? 0}
              />
            </>
          </Estado>
        </section>

        <section className="page__section-title page__section-title--con-accion">
          <h2>Padrón de Organizaciones</h2>
          {tieneRol("admin") && (padron.datos?.total ?? 0) > 0 && (
            /* Junto al título del padrón y no en el encabezado: reparte lo que
               está filtrado en esta tabla, así que tiene que leerse como parte
               de ella. */
            <button
              type="button"
              className="page__accion"
              onClick={() => setAsignandoLote(true)}
            >
              Asignar {padron.datos.total.toLocaleString("es-MX")} filtradas
            </button>
          )}
        </section>
        <OscTable
          osc={padron.datos?.osc ?? []}
          total={padron.datos?.total ?? 0}
          pagina={padron.datos?.pagina ?? pagina}
          limite={POR_PAGINA}
          requeridos={padron.datos?.documentos_requeridos ?? 16}
          cargando={padron.cargando}
          error={padron.error}
          onReintentar={padron.recargar}
          onCambiarPagina={setPagina}
          onSeleccionar={setOscSeleccionada}
        />

      </main>

      {asignandoLote && (
        <AsignarLote
          filtros={filtros}
          onCerrar={() => setAsignandoLote(false)}
          onAsignado={padron.recargar}
        />
      )}

      {oscSeleccionada !== null && (
        <OscDetalle idOsc={oscSeleccionada} onCerrar={() => setOscSeleccionada(null)} />
      )}
    </div>
  );
}

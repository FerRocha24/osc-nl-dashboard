import { useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar,
} from "recharts";
import Header from "../components/Header";
import FilterBar from "../components/FilterBar";
import { AlertRing, AlertBar, AlertNumber } from "../components/AlertCard";
import OscTable from "../components/OscTable";
import ChartPanel from "../components/ChartPanel";
import Estado from "../components/EstadoPanel";
import { useApi } from "../api/client";
import "./Pages.css";

const FILTROS_INICIALES = { municipio: "Todos", rubro: "Todos", estatus: "Todos" };
const POR_PAGINA = 10;

export default function OperativaPage() {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [pagina, setPagina] = useState(1);

  // Al cambiar un filtro se vuelve a la primera página: quedarse en la 8 tras
  // filtrar a 12 resultados dejaría la tabla vacía sin explicación.
  const cambiarFiltros = (nuevos) => {
    setFiltros(nuevos);
    setPagina(1);
  };

  const padron = useApi("osc.php", { ...filtros, pagina, limite: POR_PAGINA });
  const kpis = useApi("kpis-operativos.php");
  const registros = useApi("registros-por-mes.php", {}, []);
  const densidad = useApi("densidad-municipio.php", { limite: 8 }, []);

  const serieRegistros = registros.datos ?? [];
  const serieDensidad = densidad.datos ?? [];
  // La gráfica de altas por mes solo dice algo si hay al menos un registro;
  // 12 meses en cero se ve igual que un fallo de carga.
  const sinRegistros = serieRegistros.every((m) => m.registros === 0);

  return (
    <div className="page">
      <Header />
      <FilterBar valores={filtros} onChange={cambiarFiltros} />

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
            </>
          </Estado>
        </section>

        <section className="page__section-title">
          <h2>Padrón de Organizaciones</h2>
        </section>
        <OscTable
          osc={padron.datos?.osc ?? []}
          total={padron.datos?.total ?? 0}
          pagina={padron.datos?.pagina ?? pagina}
          limite={POR_PAGINA}
          cargando={padron.cargando}
          error={padron.error}
          onReintentar={padron.recargar}
          onCambiarPagina={setPagina}
        />

        <section className="page__grid page__grid--two">
          <ChartPanel title="Registros nuevos por mes">
            <Estado
              cargando={registros.cargando}
              error={registros.error}
              onReintentar={registros.recargar}
              vacio={serieRegistros.length === 0 || sinRegistros}
              mensajeVacio="El padrón importado no incluye fecha de registro, así que todavía no hay altas que graficar."
            >
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={serieRegistros} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-borde)" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 11, fill: "#6B6259" }} axisLine={{ stroke: "var(--color-borde)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B6259" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5E1DA", fontSize: 12 }} />
                  <Line type="monotone" dataKey="registros" name="Registros" stroke="#C2650A" strokeWidth={2.5} dot={{ r: 3 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </Estado>
          </ChartPanel>

          <ChartPanel title="Densidad de OSC por municipio">
            <Estado
              cargando={densidad.cargando}
              error={densidad.error}
              onReintentar={densidad.recargar}
              vacio={serieDensidad.length === 0}
            >
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={serieDensidad} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-borde)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6B6259" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="municipio" tick={{ fontSize: 11, fill: "#6B6259" }} width={140} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5E1DA", fontSize: 12 }} />
                  <Bar dataKey="total" name="OSC" fill="#5B87A8" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Estado>
          </ChartPanel>
        </section>
      </main>
    </div>
  );
}

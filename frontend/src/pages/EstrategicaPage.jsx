import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import Header from "../components/Header";
import FilterBar from "../components/FilterBar";
import BigNumberCard from "../components/BigNumberCard";
import ChartPanel from "../components/ChartPanel";
import Estado from "../components/EstadoPanel";
import { useApi } from "../api/client";
import "./Pages.css";

const RUBRO_COLORS = ["#C2650A", "#6E6EC2", "#3FA383", "#B23D74", "#5B87A8", "#D98E04", "#9C5108"];

// El padrón real trae 83 rubros distintos; en una dona solo caben unos
// cuantos antes de volverse ilegible, así que se muestran los principales.
const RUBROS_EN_GRAFICA = 7;

export default function EstrategicaPage() {
  const kpis = useApi("kpis-estrategicos.php");
  const rubros = useApi("distribucion-rubro.php", { limite: RUBROS_EN_GRAFICA }, []);
  // Se dejaron de usar fuentes-financiamiento.php y beneficiarios-por-edad.php:
  // sus tablas están vacías y no hay CSV que las alimente. En su lugar estos
  // dos paneles muestran el historial de inversión social, que sí tiene datos
  // reales (598 apoyos de 2023-2024). Los endpoints siguen existiendo para
  // cuando el socio formador entregue esa información.
  const apoyosTipo = useApi("apoyos-por-tipo.php", {}, []);
  const apoyosPoblacion = useApi("apoyos-por-poblacion.php", { limite: 8 }, []);
  const kpisApoyos = useApi("kpis-apoyos.php");

  const serieRubros = rubros.datos ?? [];
  const serieTipo = apoyosTipo.datos ?? [];
  const seriePoblacion = apoyosPoblacion.datos ?? [];
  const totalApoyos = kpisApoyos.datos?.total_apoyos ?? 0;

  const m = kpis.datos;

  return (
    <div className="page">
      <Header />
      {/* Sin conectar: los endpoints de esta vista agregan sobre todo el
          padrón y todavía no aceptan filtros por municipio o rubro. */}
      <FilterBar deshabilitado />

      <main className="page__content">
        <section className="page__bignumbers">
          <Estado cargando={kpis.cargando} error={kpis.error} onReintentar={kpis.recargar} alto={120}>
            <>
              <BigNumberCard
                label="Total de OSC activas"
                value={(m?.total_osc_activas ?? 0).toLocaleString("es-MX")}
                accent="primario"
              />
              <BigNumberCard
                label="Total de beneficiarios atendidos"
                value={(m?.total_beneficiarios ?? 0).toLocaleString("es-MX")}
                accent="azul"
              />
              <BigNumberCard
                label="OSC con gobernanza formal"
                value={`${m?.porcentaje_gobernanza_formal ?? 0}%`}
                accent="verde"
              />
              <BigNumberCard
                label="Dependencia de fondos públicos"
                value={`${m?.porcentaje_dependencia_fondos_publicos ?? 0}%`}
                accent="morado"
              />
            </>
          </Estado>
        </section>

        <section className="page__grid page__grid--two">
          <ChartPanel title={`Distribución de OSC por Rubro (top ${RUBROS_EN_GRAFICA})`}>
            <Estado
              cargando={rubros.cargando}
              error={rubros.error}
              onReintentar={rubros.recargar}
              vacio={serieRubros.length === 0}
              alto={260}
            >
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={serieRubros}
                    dataKey="total"
                    nameKey="rubro"
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                    isAnimationActive={false}
                  >
                    {serieRubros.map((entrada, i) => (
                      <Cell key={entrada.rubro} fill={RUBRO_COLORS[i % RUBRO_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5E1DA", fontSize: 12 }} />
                  <Legend
                    layout="vertical"
                    align="right"
                    verticalAlign="middle"
                    wrapperStyle={{ fontSize: 11, lineHeight: "18px" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </Estado>
          </ChartPanel>

          <ChartPanel
            title={`Apoyos por tipo de inversión social${totalApoyos ? ` (${totalApoyos} en 2023-2024)` : ""}`}
          >
            <Estado
              cargando={apoyosTipo.cargando}
              error={apoyosTipo.error}
              onReintentar={apoyosTipo.recargar}
              vacio={serieTipo.length === 0}
              alto={260}
            >
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={serieTipo} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-borde)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6B6259" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="tipo" tick={{ fontSize: 11, fill: "#6B6259" }} width={150} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5E1DA", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="anio_2023" name="2023" fill="#5B87A8" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                  <Bar dataKey="anio_2024" name="2024" fill="#C2650A" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Estado>
          </ChartPanel>
        </section>

        <section className="page__grid page__grid--one">
          <ChartPanel title="Apoyos por población objetivo (top 8)">
            <Estado
              cargando={apoyosPoblacion.cargando}
              error={apoyosPoblacion.error}
              onReintentar={apoyosPoblacion.recargar}
              vacio={seriePoblacion.length === 0}
              alto={300}
            >
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={seriePoblacion} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-borde)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6B6259" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="poblacion" tick={{ fontSize: 11, fill: "#6B6259" }} width={220} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5E1DA", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {/* Apiladas: la suma de las dos barras es el total del periodo,
                      y el corte por año deja ver el cambio de 2023 a 2024. */}
                  <Bar dataKey="anio_2023" stackId="a" name="2023" fill="#5B87A8" isAnimationActive={false} />
                  <Bar dataKey="anio_2024" stackId="a" name="2024" fill="#C2650A" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Estado>
          </ChartPanel>
        </section>
      </main>
    </div>
  );
}

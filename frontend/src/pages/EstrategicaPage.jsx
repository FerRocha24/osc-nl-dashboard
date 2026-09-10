import { lazy, Suspense, useState } from "react";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from "recharts";
import Header from "../components/Header";
import FilterBar from "../components/FilterBar";
import BigNumberCard from "../components/BigNumberCard";
import ChartPanel from "../components/ChartPanel";
import Estado from "../components/EstadoPanel";
import MapaMunicipios from "../components/MapaMunicipios";
import PillsMapa from "../components/PillsMapa";
import { Cargando } from "../components/EstadoPanel";
import { useApi } from "../api/client";
import "./Pages.css";

// Nueve colores para las nueve categorías: con siete, dos rebanadas de la dona
// saldrían del mismo color y parecerían la misma categoría.
const RUBRO_COLORS = [
  "#C2650A", "#6E6EC2", "#3FA383", "#B23D74", "#5B87A8",
  "#D98E04", "#9C5108", "#7A8C4A", "#6B6259",
];

const FILTROS_INICIALES = { municipio: "Todos", categoria: "Todos" };

// Leaflet y su CSS pesan ~45 KB comprimidos. Se cargan solo si alguien abre el
// mapa de ubicaciones; quien se queda en el de calor no los baja.
const MapaUbicaciones = lazy(() => import("../components/MapaUbicaciones"));

const MAPAS = [
  { valor: "calor", etiqueta: "Mapa de calor" },
  { valor: "puntos", etiqueta: "Ubicaciones" },
];

export default function EstrategicaPage() {
  const [filtros, setFiltros] = useState(FILTROS_INICIALES);
  const [mapa, setMapa] = useState("calor");

  // Todos los paneles comparten el mismo filtro, así que la vista completa
  // habla del mismo subconjunto del padrón.
  const kpis = useApi("kpis-estrategicos.php", filtros);
  // Sin `limite`: el backend agrupa los 82 rubros en 9 categorías, así que
  // caben todas en la dona sin recortar nada.
  const rubros = useApi("distribucion-rubro.php", filtros, []);
  // Se dejaron de usar fuentes-financiamiento.php y beneficiarios-por-edad.php:
  // sus tablas están vacías y no hay CSV que las alimente. En su lugar estos
  // dos paneles muestran el historial de inversión social, que sí tiene datos
  // reales (598 apoyos de 2023-2024). Los endpoints siguen existiendo para
  // cuando el socio formador entregue esa información.
  const apoyosTipo = useApi("apoyos-por-tipo.php", filtros, []);
  const apoyosPoblacion = useApi("apoyos-por-poblacion.php", { ...filtros, limite: 8 }, []);
  const kpisApoyos = useApi("kpis-apoyos.php", filtros);
  // Estas dos venían de la Vista Operativa: son lecturas del sector completo,
  // no del trabajo diario sobre una organización, así que su lugar es aquí.
  const registros = useApi("registros-por-mes.php", filtros, []);
  const densidad = useApi("densidad-municipio.php", filtros, []);

  const serieRubros = rubros.datos ?? [];
  const serieTipo = apoyosTipo.datos ?? [];
  const seriePoblacion = apoyosPoblacion.datos ?? [];
  const totalApoyos = kpisApoyos.datos?.total_apoyos ?? 0;
  const serieRegistros = registros.datos ?? [];
  const serieDensidad = densidad.datos ?? [];
  // 12 meses en cero se ve igual que un fallo de carga, así que se trata como
  // "sin datos" y se explica por qué.
  const sinRegistros = serieRegistros.every((m) => m.registros === 0);
  // El mapa y la barra comparten datos, pero la barra solo muestra los de más
  // peso: 34 municipios en barras horizontales no se leen.
  const topDensidad = [...serieDensidad].slice(0, 10);

  // Al hacer clic en un municipio del mapa se filtra la vista completa, y al
  // volver a hacer clic en el mismo se quita el filtro.
  const alternarMunicipio = (nombre) =>
    setFiltros((f) => ({ ...f, municipio: f.municipio === nombre ? "Todos" : nombre }));

  const m = kpis.datos;

  // La Vista Estratégica no tiene una tabla: se exportan los agregados que
  // están en pantalla, uno tras otro con su encabezado, para que el archivo se
  // entienda solo al abrirlo.
  const exportacion = {
    nombre: "resumen-estrategico",
    etiquetaCsv: "Exportar resumen",
    obtenerDatos: async () => ({
      columnas: [
        { clave: "seccion", titulo: "Sección" },
        { clave: "concepto", titulo: "Concepto" },
        { clave: "total", titulo: "Total" },
        { clave: "anio_2023", titulo: "2023" },
        { clave: "anio_2024", titulo: "2024" },
      ],
      filas: [
        { seccion: "Indicadores", concepto: "Total de OSC activas", total: m?.total_osc_activas ?? 0 },
        { seccion: "Indicadores", concepto: "Total de beneficiarios atendidos", total: m?.total_beneficiarios ?? 0 },
        { seccion: "Indicadores", concepto: "OSC con gobernanza formal (%)", total: m?.porcentaje_gobernanza_formal ?? 0 },
        { seccion: "Indicadores", concepto: "Dependencia de fondos públicos (%)", total: m?.porcentaje_dependencia_fondos_publicos ?? 0 },
        ...serieRubros.map((r) => ({ seccion: "OSC por rubro", concepto: r.rubro, total: r.total })),
        ...serieTipo.map((t) => ({
          seccion: "Apoyos por tipo", concepto: t.tipo,
          total: t.total, anio_2023: t.anio_2023, anio_2024: t.anio_2024,
        })),
        ...seriePoblacion.map((p) => ({
          seccion: "Apoyos por población", concepto: p.poblacion,
          total: p.total, anio_2023: p.anio_2023, anio_2024: p.anio_2024,
        })),
      ],
    }),
  };

  return (
    <div className="page">
      <Header exportacion={exportacion} />
      <FilterBar
        campos={["municipio", "categoria"]}
        valores={filtros}
        onChange={setFiltros}
        mostrarFechas={false}
      />

      <main className="page__content">
        <section className="page__bignumbers">
          <Estado cargando={kpis.cargando} error={kpis.error} onReintentar={kpis.recargar} alto={120}>
            <>
              <BigNumberCard
                label="Total de OSC activas"
                value={(m?.total_osc_activas ?? 0).toLocaleString("es-MX")}
                accent="primario"
              />
              {/* null y no cero: el backend distingue "no se puede calcular"
                  de "el valor medido es cero". */}
              <BigNumberCard
                label="Total de beneficiarios atendidos"
                value={m?.total_beneficiarios == null
                  ? null : m.total_beneficiarios.toLocaleString("es-MX")}
                faltante={m?.faltantes?.total_beneficiarios}
                accent="azul"
              />
              <BigNumberCard
                label="OSC con gobernanza formal"
                value={m?.porcentaje_gobernanza_formal == null
                  ? null : `${m.porcentaje_gobernanza_formal}%`}
                faltante={m?.faltantes?.porcentaje_gobernanza_formal}
                accent="verde"
              />
              <BigNumberCard
                label="Dependencia de fondos públicos"
                value={m?.porcentaje_dependencia_fondos_publicos == null
                  ? null : `${m.porcentaje_dependencia_fondos_publicos}%`}
                faltante={m?.faltantes?.porcentaje_dependencia_fondos_publicos}
                accent="morado"
              />
            </>
          </Estado>
        </section>

        <section className="page__grid page__grid--two">
          <ChartPanel title="Distribución de OSC por categoría">
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
                    wrapperStyle={{
                      fontSize: 11,
                      lineHeight: "18px",
                      // Recharts posiciona la leyenda en absoluto y no la
                      // recorta: con muchas series se derrama sobre el resto
                      // de la página y llega a tapar controles de otros
                      // paneles. Pasó en producción, con un backend viejo que
                      // devolvía los 82 rubros sin agrupar en vez de las 9
                      // categorías: la lista tapaba las pastillas del mapa y
                      // no dejaba hacer clic. El tope y el scroll propio hacen
                      // que un dato inesperado degrade la leyenda, no la
                      // página entera.
                      maxHeight: 240,
                      maxWidth: "45%",
                      overflowY: "auto",
                    }}
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

        <section className="page__grid page__grid--two">
          <ChartPanel
            title="Distribución geográfica de OSC"
            acciones={
              <PillsMapa valor={mapa} onCambiar={setMapa} opciones={MAPAS} />
            }
          >
            {mapa === "calor" ? (
              <MapaMunicipios
                datos={serieDensidad}
                cargando={densidad.cargando}
                error={densidad.error}
                onReintentar={densidad.recargar}
                onSeleccionar={alternarMunicipio}
              />
            ) : (
              <Suspense fallback={<Cargando alto={320} />}>
                <MapaUbicaciones filtros={filtros} />
              </Suspense>
            )}
          </ChartPanel>

          <ChartPanel title="Municipios con más organizaciones">
            <Estado
              cargando={densidad.cargando}
              error={densidad.error}
              onReintentar={densidad.recargar}
              vacio={topDensidad.length === 0}
              alto={420}
            >
              <ResponsiveContainer width="100%" height={420}>
                <BarChart data={topDensidad} layout="vertical" margin={{ top: 5, right: 24, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-borde)" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: "#6B6259" }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="municipio" tick={{ fontSize: 11, fill: "#6B6259" }} width={150} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid #E5E1DA", fontSize: 12 }} />
                  <Bar dataKey="total" name="OSC" fill="#5B87A8" radius={[0, 4, 4, 0]} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </Estado>
          </ChartPanel>
        </section>

        <section className="page__grid page__grid--one">
          <ChartPanel title="Registros nuevos por mes">
            <Estado
              cargando={registros.cargando}
              error={registros.error}
              onReintentar={registros.recargar}
              vacio={serieRegistros.length === 0 || sinRegistros}
              mensajeVacio="El padrón importado no incluye fecha de registro, así que todavía no hay altas que graficar."
              alto={220}
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

// Datos de muestra — simulan el padrón de OSC de Nuevo León
// Estructura basada en el modelo de datos definido en la Actividad 3.2

export const osc = [
  { id: 1, razonSocial: "Manos que Ayudan A.C.", municipio: "Monterrey", rubro: "Asistencia alimentaria", subRubro: "Comedores", donatariaVigente: true, estatusDocumental: "Completo", ultimaActualizacion: "2026-08-12" },
  { id: 2, razonSocial: "Un Nuevo León A.C.", municipio: "San Pedro Garza García", rubro: "Educación de calidad", subRubro: "Educación", donatariaVigente: true, estatusDocumental: "Completo", ultimaActualizacion: "2026-08-20" },
  { id: 3, razonSocial: "Fundación Ayudamos", municipio: "Guadalupe", rubro: "Reducción de las desigualdades", subRubro: "Personas adultas mayores", donatariaVigente: false, estatusDocumental: "Vencido", ultimaActualizacion: "2025-11-03" },
  { id: 4, razonSocial: "Instituto Down de Monterrey A.B.P.", municipio: "Monterrey", rubro: "Salud y bienestar", subRubro: "Discapacidad Intelectual", donatariaVigente: true, estatusDocumental: "Pendiente", ultimaActualizacion: "2026-07-29" },
  { id: 5, razonSocial: "Voluntariado Regio A.C.", municipio: "San Nicolás de los Garza", rubro: "Paz Justicia e instituciones sólidas", subRubro: "Voluntariado", donatariaVigente: true, estatusDocumental: "Completo", ultimaActualizacion: "2026-08-25" },
  { id: 6, razonSocial: "Mujeres Unidas NL A.C.", municipio: "Monterrey", rubro: "Igualdad de género", subRubro: "Atención a mujeres", donatariaVigente: true, estatusDocumental: "Completo", ultimaActualizacion: "2026-08-18" },
  { id: 7, razonSocial: "Despensas del Norte A.C.", municipio: "Apodaca", rubro: "Asistencia alimentaria", subRubro: "Despensas", donatariaVigente: false, estatusDocumental: "Vencido", ultimaActualizacion: "2025-09-14" },
  { id: 8, razonSocial: "Fundación Crecer Juntos", municipio: "Santa Catarina", rubro: "Fin de la pobreza", subRubro: "Atención social", donatariaVigente: true, estatusDocumental: "Pendiente", ultimaActualizacion: "2026-06-30" },
  { id: 9, razonSocial: "Renacer Adicciones A.C.", municipio: "Escobedo", rubro: "Salud y bienestar", subRubro: "Adicciones", donatariaVigente: true, estatusDocumental: "Completo", ultimaActualizacion: "2026-08-22" },
  { id: 10, razonSocial: "Niñez Protegida NL", municipio: "Monterrey", rubro: "Reducción de las desigualdades", subRubro: "Niños, Adolescentes y jóvenes", donatariaVigente: true, estatusDocumental: "Completo", ultimaActualizacion: "2026-08-15" },
];

// Registros nuevos por mes (últimos 12 meses)
export const registrosPorMes = [
  { mes: "Sep 25", registros: 4 },
  { mes: "Oct 25", registros: 6 },
  { mes: "Nov 25", registros: 3 },
  { mes: "Dic 25", registros: 2 },
  { mes: "Ene 26", registros: 5 },
  { mes: "Feb 26", registros: 7 },
  { mes: "Mar 26", registros: 8 },
  { mes: "Abr 26", registros: 6 },
  { mes: "May 26", registros: 9 },
  { mes: "Jun 26", registros: 11 },
  { mes: "Jul 26", registros: 8 },
  { mes: "Ago 26", registros: 10 },
];

// Densidad de OSC por municipio
export const densidadMunicipio = [
  { municipio: "Monterrey", total: 142 },
  { municipio: "Guadalupe", total: 58 },
  { municipio: "San Nicolás de los Garza", total: 41 },
  { municipio: "Apodaca", total: 34 },
  { municipio: "San Pedro Garza García", total: 29 },
  { municipio: "Santa Catarina", total: 22 },
  { municipio: "Escobedo", total: 19 },
  { municipio: "Juárez", total: 12 },
];

// Distribución por rubro
export const distribucionRubro = [
  { rubro: "Salud y bienestar", total: 86 },
  { rubro: "Reducción de las desigualdades", total: 64 },
  { rubro: "Asistencia alimentaria", total: 51 },
  { rubro: "Educación de calidad", total: 44 },
  { rubro: "Igualdad de género", total: 33 },
  { rubro: "Fin de la pobreza", total: 28 },
  { rubro: "Paz, justicia e instituciones sólidas", total: 21 },
];

// Fuentes de financiamiento del sector (%)
export const fuentesFinanciamiento = [
  { fuente: "Donativos empresas", porcentaje: 32 },
  { fuente: "Donativo Gobierno Estatal", porcentaje: 24 },
  { fuente: "Donativos personas físicas", porcentaje: 18 },
  { fuente: "Aportación de beneficiarios", porcentaje: 12 },
  { fuente: "Donativo Gobierno Federal", porcentaje: 9 },
  { fuente: "Colectas / Eventos", porcentaje: 5 },
];

// Beneficiarios por rango de edad y género
export const beneficiariosPorEdad = [
  { rango: "0-11", hombres: 320, mujeres: 298 },
  { rango: "12-17", hombres: 410, mujeres: 385 },
  { rango: "18-29", hombres: 512, mujeres: 601 },
  { rango: "30-59", hombres: 890, mujeres: 1120 },
  { rango: "60+", hombres: 456, mujeres: 602 },
];

// Métricas globales (Vista Estratégica)
export const metricasGlobales = {
  totalOSCActivas: 327,
  totalBeneficiarios: 6594,
  porcentajeGobernanzaFormal: 61,
  indiceDependenciaFondosPublicos: 33,
};

// Métricas operativas (Vista Operativa)
export const metricasOperativas = {
  porcentajeDonatariaVigente: 78,
  porcentajeCompletitudDocumental: 84,
  oscDocumentacionIncompleta: 23,
};

export const municipiosFiltro = [
  "Todos", "Monterrey", "Guadalupe", "San Nicolás de los Garza", "Apodaca",
  "San Pedro Garza García", "Santa Catarina", "Escobedo", "Juárez",
];

export const rubrosFiltro = [
  "Todos", "Salud y bienestar", "Reducción de las desigualdades",
  "Asistencia alimentaria", "Educación de calidad", "Igualdad de género",
  "Fin de la pobreza", "Paz Justicia e instituciones sólidas",
];

export const estatusFiltro = ["Todos", "Completo", "Pendiente", "Vencido"];

<?php
// Reglas de negocio expresadas como fragmentos de SQL reutilizables.
//
// ¡IMPORTANTE! Aquí viven los SUPUESTOS que hubo que tomar porque el modelo
// de datos actual (migraciones 001–007) no tiene una columna directa para
// ciertos indicadores del tablero. Están centralizados a propósito: si el
// socio formador aclara la definición correcta, se cambia SOLO en este
// archivo y todos los endpoints quedan corregidos de una vez.

// --- SUPUESTO 1: "donataria vigente" ---------------------------------------
// La tabla OSC no tiene una columna de estatus de donataria autorizada.
// Lo más cercano es `fecha_ultima_publicacion_dof` (la autorización como
// donataria se publica en el Diario Oficial de la Federación y se renueva
// cada año), así que se considera vigente si esa publicación ocurrió dentro
// de los últimos 12 meses.
//
// Si más adelante se agrega una columna real (p. ej. `donataria_vigente`
// BOOLEAN en una migración 010), cambiar esta constante por:
//   const SQL_DONATARIA_VIGENTE = 'o.donataria_vigente = 1';
const SQL_DONATARIA_VIGENTE =
    "(o.fecha_ultima_publicacion_dof IS NOT NULL
      AND o.fecha_ultima_publicacion_dof >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR))";

// --- SUPUESTO 2: "estatus documental" de una OSC ---------------------------
// La tabla Documentacion guarda el estatus por documento, no por OSC.
// Se agrega al nivel de OSC con la regla "el peor estatus manda":
//   - si tiene algún documento Rechazado    -> Rechazado
//   - si no, pero tiene alguno Vencido      -> Vencido
//   - si no, pero tiene alguno Pendiente    -> Pendiente
//   - si no tiene ningún documento cargado  -> Pendiente
//   - en cualquier otro caso                -> Completo
//
// Rechazado va primero porque exige acción de la organización: un documento
// vencido se renueva, pero uno rechazado hay que rehacerlo.
const SQL_ESTATUS_DOCUMENTAL =
    "CASE
        WHEN COUNT(d.id_documento) = 0 THEN 'Pendiente'
        WHEN SUM(d.estatus_validacion = 'Rechazado') > 0 THEN 'Rechazado'
        WHEN SUM(d.estatus_validacion = 'Vencido')   > 0 THEN 'Vencido'
        WHEN SUM(d.estatus_validacion = 'Pendiente') > 0 THEN 'Pendiente'
        ELSE 'Completo'
     END";

// --- SUPUESTO 3: "fuente de financiamiento pública" ------------------------
// `tipo_fuente` es texto libre, no un catálogo. Se clasifica como recurso
// público cualquier fuente cuyo nombre mencione gobierno o un orden de
// gobierno (federal / estatal / municipal).
const SQL_FUENTE_ES_PUBLICA =
    "(f.tipo_fuente LIKE '%Gobierno%'
      OR f.tipo_fuente LIKE '%Público%'  OR f.tipo_fuente LIKE '%Publico%'
      OR f.tipo_fuente LIKE '%Federal%'
      OR f.tipo_fuente LIKE '%Estatal%'
      OR f.tipo_fuente LIKE '%Municipal%')";

// --- SUPUESTO 4: "gobernanza formal" ---------------------------------------
// Se considera que una OSC tiene gobernanza formal si cuenta con un órgano
// de gobierno constituido. (Criterio alterno, más estricto, sería exigir
// además informe anual y estados financieros.)
const SQL_GOBERNANZA_FORMAL = 't.tiene_organo_gobierno = 1';

// --- SUPUESTO 5: "OSC activa" ----------------------------------------------
// La tabla OSC no tiene columna de baja / inactividad, así que toda OSC
// registrada cuenta como activa.
const SQL_OSC_ACTIVA = '1 = 1';

// --- SUPUESTO 6: normalización de "población objetivo" en Apoyos -----------
// El vocabulario del catálogo CAMBIÓ entre 2023 y 2024, y las dos versiones
// conviven en la misma columna. Verificado contra la base:
//
//   "Niñas, niños y adolescentes"  solo 2023 (86)  ─┐ misma población
//   "NNA"                          solo 2024 (64)  ─┘ → 150
//   "Personas con discapacidad"    solo 2023 (33)  ─┐
//   "P. Discapacidad"              solo 2024 (41)  ─┘ → 74
//   "Personas adultas mayores"     solo 2023 (14)  ─┐
//   "P. Adulta mayor"              solo 2024 (19)  ─┘ → 33
//   "Grupos indígenas" / "Indígenas" / "P. Indígenas"  → 7
//
// Sin unificar, una gráfica mostraría el mismo grupo dos veces y cada mitad
// parecería existir un solo año. Aquí solo se fusionan los pares que son
// inequívocamente la misma población; el resto de las "P. algo" solo se
// escriben completas para que la etiqueta se lea bien, sin combinar nada.
//
// Ojo: "Primera infancia" NO se fusiona con NNA — es una franja etaria
// distinta (0-5 años) y el catálogo de 2024 las usa por separado.
const SQL_POBLACION_NORMALIZADA = "
    CASE TRIM(a.poblacion)
        WHEN 'NNA'                       THEN 'Niñas, niños y adolescentes'
        WHEN 'P. Discapacidad'           THEN 'Personas con discapacidad'
        WHEN 'P. Adulta mayor'           THEN 'Personas adultas mayores'
        WHEN 'P. Indígenas'              THEN 'Personas indígenas'
        WHEN 'Indígenas'                 THEN 'Personas indígenas'
        WHEN 'Grupos indígenas'          THEN 'Personas indígenas'
        WHEN 'P. vulnerables'            THEN 'Personas en situación de vulnerabilidad'
        WHEN 'P. Enfermedades'           THEN 'Personas con enfermedades'
        WHEN 'P. Adicciones'             THEN 'Personas con adicciones'
        WHEN 'P. Migrantes'              THEN 'Personas migrantes'
        WHEN 'P. Privadas Libertad'      THEN 'Personas privadas de la libertad'
        WHEN 'P. Situación Calle'        THEN 'Personas en situación de calle'
        ELSE TRIM(a.poblacion)
    END";

// --- SUPUESTO 7: etiqueta y orden del tipo de apoyo ------------------------
// `tipo_apoyo` viene con un prefijo numérico del catálogo original
// ("1. Anual", "5. Inclusión prioritaria"). El número sirve para ordenar de
// forma estable, pero estorba en la etiqueta de una gráfica.
const SQL_TIPO_APOYO_ETIQUETA =
    "TRIM(SUBSTRING(a.tipo_apoyo, LOCATE('.', a.tipo_apoyo) + 1))";
const SQL_TIPO_APOYO_ORDEN =
    "CAST(SUBSTRING_INDEX(a.tipo_apoyo, '.', 1) AS UNSIGNED)";

// --- SUPUESTO 8: agrupación de rubros en categorías -----------------------
// El padrón trae 82 valores distintos en `rubro`, porque el CSV solo tiene el
// "Rubro Específico" y no una categoría general (ver CONTEXTO_PARA_CLAUDE_CODE).
// Una gráfica con 82 rebanadas no comunica nada, y mostrar solo el "top 7"
// esconde a la mitad del padrón.
//
// Esta agrupación la propuso el equipo de desarrollo a partir de los nombres,
// NO viene del socio formador. **Debe validarse con ellos** antes de usarla en
// un reporte oficial. Cambiarla es editar solo este bloque.
//
// "Generales" (71 organizaciones) y "Seleccione Rubro Especifico" (4) no son
// rubros: son el valor por defecto del formulario de captura. Se agrupan como
// "Sin clasificar" para que se vea el tamaño real del problema de captura en
// lugar de disimularlo.
const SQL_CATEGORIA_RUBRO = "
    CASE
        WHEN o.rubro IS NULL OR TRIM(o.rubro) = '' THEN 'Sin clasificar'
        WHEN TRIM(o.rubro) IN (
            'Generales', 'Otros', 'Seleccione Rubro Especifico'
        ) THEN 'Sin clasificar'
        WHEN TRIM(o.rubro) IN (
            'Educación', 'Formación y educación', 'Educación especial',
            'Capacitación General', 'Formación y valores', 'Becas',
            'Capacitación', 'Capacitación y proyectos productivos',
            'Albergues educativos', 'Educación y formación',
            'Otros-Comedor, Educación y Formación'
        ) THEN 'Educación y formación'
        WHEN TRIM(o.rubro) IN (
            'Enfermedades especificas', 'Alcohol y drogas', 'Servicios médicos',
            'Enfermedades mentales', 'Adicciones', 'Alcohol', 'Drogas',
            'Prevención de enfermedades', 'Prevención', 'Enfermos',
            'Rehabilitación juvenil'
        ) THEN 'Salud y adicciones'
        WHEN TRIM(o.rubro) IN (
            'Neuromotora', 'Ciegos y débiles visuales', 'Audición y lenguaje',
            'Intelectual', 'Discapacidad neuromotora',
            'Discapacidad auditiva y de lenguaje', 'Discapacidad Intelectual',
            'Discapacidad visual'
        ) THEN 'Discapacidad'
        WHEN TRIM(o.rubro) IN (
            'Comedores', 'Casa hogar', 'Casa de reposo',
            'Distribución de despensas', 'Despensas', 'Albergues',
            'Asistencia Social', 'Atención social', 'Atención y cuidado',
            'Atenciones y Cuidados', 'Otros asistenciales', 'Temporales',
            'Centro de Asistencia Social (Ley General de Derechos de Niñas, Niños y Adolescentes)',
            'Centro de Asistencia Social Temporales(Ley General de Derechos de Niñas, Niños y Adolescentes)',
            'Otros-Albergue', 'Otros-Brigadas de Asistencia Social',
            'Personas adultas mayores: atención y cuidados',
            'Personas adultas mayores: casa de reposo',
            'Guarderías', 'Familia', 'Emergencias',
            'Participación en acciones de protección civil'
        ) THEN 'Asistencia social y alimentaria'
        WHEN TRIM(o.rubro) IN (
            'Derechos humanos', 'Género', 'Derechos sexuales',
            'Atención a mujeres', 'Violencia familiar', 'Violencia de género',
            'Violencia', 'Jurídico'
        ) THEN 'Derechos humanos y género'
        WHEN TRIM(o.rubro) IN (
            'Fortalecedoras del sector social',
            'Prestación de servicios no lucrativos para la creación y fortalecimiento de organizaciones',
            'Actividad cívica enfocada a promover la participación ciudadana en asuntos de interes público',
            'Actividad cívica enfocada', 'Voluntariado', 'Clubes',
            'Instituciones de Servicio a la Comunidad', 'Donativos',
            'Causas y actividades', 'Deportes'
        ) THEN 'Fortalecimiento y participación'
        WHEN TRIM(o.rubro) IN (
            'Proyectos productivos', 'Desarrollo', 'Orientación',
            'Orientación social'
        ) THEN 'Desarrollo y proyectos productivos'
        WHEN TRIM(o.rubro) IN (
            'Niños, Adolescentes y jóvenes', 'Personas migrantes',
            'Otros-Migrantes', 'Personas privadas de su libertad',
            'Personas indígenas'
        ) THEN 'Grupos en situación de vulnerabilidad'
        ELSE 'Sin clasificar'
    END";

// --- Catálogo: estatus de operación -----------------------------------------
// Los cuatro valores que trae la columna EstatusObservacion del padrón de la
// Secretaría. Describen si la organización SIGUE OPERANDO, no si el Registro
// la admitió: ninguno dice "no registrada", porque a la que le niegan el
// registro nunca la agregan al padrón. "Baja" solo aplica a algo que estuvo
// dentro.
const ESTATUS_OPERACION = [
    'Activa',
    'Actualizada',
    'Sin evidencia de operación',
    'Baja',
];

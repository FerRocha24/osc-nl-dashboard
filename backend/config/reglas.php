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
//   - si tiene algún documento Vencido      -> Vencido
//   - si no, pero tiene alguno Pendiente    -> Pendiente
//   - si no tiene ningún documento cargado  -> Pendiente
//   - en cualquier otro caso                -> Completo
const SQL_ESTATUS_DOCUMENTAL =
    "CASE
        WHEN COUNT(d.id_documento) = 0 THEN 'Pendiente'
        WHEN SUM(d.estatus_validacion = 'Vencido')  > 0 THEN 'Vencido'
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

<?php
// Importación del padrón desde el CSV que la Secretaría usa en su operación.
//
// El archivo tiene 72 columnas en una sola hoja plana. Este módulo traduce esa
// forma al modelo normalizado: los datos de la organización van a OSC, los
// beneficiarios se convierten en filas por rango de edad, y las banderas de
// documentos se vuelven registros del expediente.
//
// Dos principios que guían todo lo de aquí:
//
//   1. ACTUALIZA, no reemplaza. Las organizaciones que estén en la base pero
//      no en el archivo se quedan intactas. Importar nunca da de baja a nadie.
//   2. VALIDA antes de escribir. Primero se analiza el archivo completo y se
//      reporta qué va a pasar; escribir es un segundo paso que la persona
//      confirma.

require_once __DIR__ . '/env.php';

const IMPORTE_MAX_FILAS = 5000;
const IMPORTE_MAX_BYTES = 15 * 1024 * 1024;

/**
 * Equivalencias entre las columnas del archivo y las de la base.
 *
 * Las llaves se comparan ya normalizadas (sin acentos, minúsculas, sin
 * espacios ni guiones bajos), porque los encabezados del archivo son
 * inconsistentes: conviven "Correo 1", "CalleyNumero" y "fecha_registro", y
 * algunos traen errores de captura que conviene aceptar tal cual en lugar de
 * pedirle a la dependencia que corrija el archivo.
 */
const COLUMNAS_OSC = [
    'idorganizacion'                    => 'no_registro',
    'organizacion'                      => 'razon_social',
    'aliasorganizacion'                 => 'alias',
    'rfc'                               => 'rfc',
    'mision'                            => 'mision',
    'actividadprincipal'                => 'actividad_principal',
    'descripcionrubrogenerla'           => 'rubro_general',   // el error viene del archivo
    'descripcionrubrogeneral'           => 'rubro_general',   // por si lo corrigen
    'descripcionrubroespecifico'        => 'rubro',
    'tipoorganizacion'                  => 'tipo_organizacion',
    'calleynumero'                      => 'direccion',
    'colonia'                           => 'colonia',
    'telefono1'                         => 'telefono',
    'telefono2'                         => 'telefono2',
    'telefono3'                         => 'telefono3',
    'fax'                               => 'fax',
    'telefonocelular'                   => 'celular',
    'paginaweb'                         => 'sitio_web',
    'presidente'                        => 'nombre_presidente',
    'director'                          => 'director',
    'responsable'                       => 'responsable',
    'representantelegal'                => 'representante_legal',
    'contacto'                          => 'nombre_contacto',
    'puestocontacto'                    => 'puesto_contacto',
    'fecharegistro'                     => 'fecha_registro',
    'fechaconstitucion'                 => 'fecha_constitucion',
    'fechaactualizacion'                => 'fecha_actualizacion',
    'estatusobservacion'                => 'estatus_operacion',
    'observacionesestatus'              => 'observaciones_estatus',
    'fechaactualizacionobservaciones'   => 'fecha_actualizacion_observaciones',
    'tipoinmueble'                      => 'tipo_inmueble',
    'ultimafechavisita'                 => 'ultima_fecha_visita',
    'ultimavisitaobservacion'           => 'ultima_visita_observacion',
    'horarioservicio'                   => 'horario_servicio',
    'latitud'                           => 'latitud',
    'longitud'                          => 'longitud',
];

// Los cuatro correos del archivo se juntan en una sola columna, separados por
// "; ", que es como ya venían los datos de la importación anterior.
const COLUMNAS_CORREO = ['correo1', 'correo2', 'correo3', 'correo4'];

// Banderas de documentos: columna del archivo => tipo de documento legible.
// El archivo indica si el documento EXISTE en el expediente físico, no adjunta
// el archivo. Por eso se crean registros sin adjunto, que el personal puede
// completar después subiendo el PDF desde el tablero.
const COLUMNAS_DOCUMENTO = [
    'dactaconstitutiva'                          => 'Acta constitutiva',
    'dcopiarfc'                                  => 'Copia del RFC',
    'dcomprobantedomicilio'                      => 'Comprobante de domicilio',
    'didentificacionoficialrepresentantelegal'   => 'Identificación del representante legal',
    'dcartaacreditacionbancaria'                 => 'Carta de acreditación bancaria',
    'ddeclaracionanual'                          => 'Declaración anual',
    'ddictamenfiscal'                            => 'Dictamen fiscal',
    'dacreditaciondonatariaautorizada'           => 'Acreditación como donataria autorizada',
    'dfichavisita'                               => 'Ficha de visita',
    'dpoderrepresentantelegal'                   => 'Poder del representante legal',
    'dcluni'                                     => 'CLUNI',
    'dformatoinscripcion'                        => 'Formato de inscripción',
    'dplantrabajoanual'                          => 'Plan de trabajo anual',
    'dsecretariaeducacion'                       => 'Registro ante Secretaría de Educación',
    'dsecretariasalud'                           => 'Registro ante Secretaría de Salud',
    'ddif'                                       => 'Registro ante DIF',
];

// Beneficiarios: el archivo trae columnas planas por grupo etario y género.
// El modelo guarda una fila por rango, que permite agregar sin reescribir
// consultas cuando cambien los grupos.
const COLUMNAS_BENEFICIARIO = [
    'Niñas y niños' => ['hombresninos', 'mujeresninas'],
    'Jóvenes'       => ['hombresjovenes', 'mujeresjovenes'],
    'Personas adultas' => ['hombresadultos', 'mujeresadultos'],
];

// Quita acentos, mayúsculas y separadores para comparar encabezados.
function normalizarEncabezado(string $texto): string
{
    $texto = str_replace(
        ['á','é','í','ó','ú','ñ','Á','É','Í','Ó','Ú','Ñ','ü','Ü'],
        ['a','e','i','o','u','n','a','e','i','o','u','n','u','u'],
        $texto
    );
    return preg_replace('/[^a-z0-9]/', '', mb_strtolower(trim($texto)));
}

// Interpreta las banderas de documentos, que en el archivo aparecen como
// "Sí", "SI", "X", "1" o vacío según quién capturó la fila.
function esAfirmativo(?string $valor): bool
{
    $v = normalizarEncabezado((string) $valor);
    return in_array($v, ['si', 'x', '1', 'true', 'verdadero'], true);
}

// Convierte una fecha del archivo a formato de MySQL. Acepta los formatos que
// produce Excel en español; devuelve null si no reconoce el valor, en lugar de
// inventar una fecha.
function fechaSql(?string $valor): ?string
{
    $v = trim((string) $valor);
    if ($v === '') {
        return null;
    }
    foreach (['Y-m-d', 'd/m/Y', 'd-m-Y', 'Y/m/d', 'd/m/y'] as $formato) {
        $f = DateTime::createFromFormat($formato, $v);
        if ($f && $f->format($formato) === $v) {
            return $f->format('Y-m-d');
        }
    }
    return null;
}

// Convierte una coordenada. Fuera del rango de Nuevo León se descarta: un
// punto mal capturado colocaría una organización en otro continente.
function coordenadaValida(?string $valor, float $min, float $max): ?float
{
    $v = trim((string) $valor);
    if ($v === '' || !is_numeric($v)) {
        return null;
    }
    $n = (float) $v;
    return ($n >= $min && $n <= $max) ? $n : null;
}

/**
 * Lee el CSV y lo convierte en filas ya interpretadas, con sus advertencias.
 *
 * No toca la base: solo analiza. Así el mismo código sirve para la vista
 * previa y para la importación real, y no hay riesgo de que difieran.
 */
function analizarCsv(string $ruta): array
{
    if (filesize($ruta) > IMPORTE_MAX_BYTES) {
        throw new RuntimeException('El archivo supera los 15 MB permitidos.');
    }

    $fh = fopen($ruta, 'r');
    if (!$fh) {
        throw new RuntimeException('No se pudo abrir el archivo.');
    }

    // El separador se detecta de la primera línea: Excel en español guarda con
    // punto y coma, y otras herramientas con coma. Adivinar mal deja todo en
    // una sola columna.
    $primera = fgets($fh);
    if ($primera === false) {
        fclose($fh);
        throw new RuntimeException('El archivo está vacío.');
    }
    $separador = substr_count($primera, ';') > substr_count($primera, ',') ? ';' : ',';
    rewind($fh);

    // escape: '' sigue el estándar RFC 4180. El escape con barra invertida
    // es una herencia de PHP que no forma parte del formato CSV y que en 8.5
    // ya exige declararse explícitamente.
    $encabezados = fgetcsv($fh, 0, $separador, '"', '');
    if (!$encabezados) {
        fclose($fh);
        throw new RuntimeException('No se pudieron leer los encabezados.');
    }
    // Quita la marca BOM que Excel deja al inicio y que pegaría al primer
    // encabezado un carácter invisible.
    $encabezados[0] = preg_replace('/^\x{FEFF}/u', '', $encabezados[0]);

    $indice = [];
    foreach ($encabezados as $i => $h) {
        $indice[normalizarEncabezado((string) $h)] = $i;
    }

    if (!isset($indice['idorganizacion']) && !isset($indice['organizacion'])) {
        fclose($fh);
        throw new RuntimeException(
            'El archivo no tiene las columnas "ID_Organizacion" ni "Organizacion". ' .
            '¿Es el archivo del padrón?'
        );
    }

    $valor = function (array $fila, string $clave) use ($indice): ?string {
        if (!isset($indice[$clave])) {
            return null;
        }
        $v = $fila[$indice[$clave]] ?? null;
        $v = is_string($v) ? trim($v) : $v;
        return ($v === '' || $v === null) ? null : $v;
    };

    $filas = [];
    $advertencias = [];
    $numero = 1;

    while (($cruda = fgetcsv($fh, 0, $separador, '"', '')) !== false) {
        $numero++;
        if (count(array_filter($cruda, fn($c) => trim((string) $c) !== '')) === 0) {
            continue;  // línea en blanco
        }
        if (count($filas) >= IMPORTE_MAX_FILAS) {
            $advertencias[] = "El archivo excede las " . IMPORTE_MAX_FILAS .
                " filas permitidas; se ignoraron las restantes.";
            break;
        }

        $razon = $valor($cruda, 'organizacion');
        if ($razon === null) {
            $advertencias[] = "Fila $numero: sin nombre de organización, se omite.";
            continue;
        }

        $osc = [];
        foreach (COLUMNAS_OSC as $columnaCsv => $campo) {
            $v = $valor($cruda, $columnaCsv);
            if ($v !== null) {
                $osc[$campo] = $v;
            }
        }

        // Fechas: se normalizan y se avisa de las que no se entienden, en
        // lugar de guardar basura o inventar un valor.
        foreach (['fecha_registro', 'fecha_constitucion', 'fecha_actualizacion',
                  'fecha_actualizacion_observaciones', 'ultima_fecha_visita'] as $campo) {
            if (isset($osc[$campo])) {
                $convertida = fechaSql($osc[$campo]);
                if ($convertida === null) {
                    $advertencias[] = "Fila $numero: la fecha \"{$osc[$campo]}\" en $campo no se reconoció; se dejó vacía.";
                }
                $osc[$campo] = $convertida;
            }
        }

        // Coordenadas dentro de Nuevo León.
        $osc['latitud']  = coordenadaValida($osc['latitud']  ?? null, 23.0, 28.0);
        $osc['longitud'] = coordenadaValida($osc['longitud'] ?? null, -101.5, -98.0);
        if (($osc['latitud'] === null) !== ($osc['longitud'] === null)) {
            $advertencias[] = "Fila $numero: la ubicación está incompleta o fuera de Nuevo León; no se guardó.";
            $osc['latitud'] = $osc['longitud'] = null;
        }

        // Estatus: solo se aceptan los valores del catálogo.
        if (isset($osc['estatus_operacion'])) {
            $permitidos = ['Activa', 'Actualizada', 'Baja', 'Sin evidencia de operación'];
            $encontrado = null;
            foreach ($permitidos as $p) {
                if (normalizarEncabezado($p) === normalizarEncabezado($osc['estatus_operacion'])) {
                    $encontrado = $p;
                }
            }
            if ($encontrado === null) {
                $advertencias[] = "Fila $numero: el estatus \"{$osc['estatus_operacion']}\" no está en el catálogo; se dejó vacío.";
            }
            $osc['estatus_operacion'] = $encontrado;
        }

        // Los cuatro correos se unen en un solo campo.
        $correos = [];
        foreach (COLUMNAS_CORREO as $c) {
            $v = $valor($cruda, $c);
            if ($v !== null) {
                $correos[] = $v;
            }
        }
        if ($correos) {
            $osc['correos'] = mb_substr(implode('; ', $correos), 0, 255);
        }

        // Documentos presentes en el expediente físico.
        $documentos = [];
        foreach (COLUMNAS_DOCUMENTO as $columnaCsv => $tipo) {
            if (esAfirmativo($valor($cruda, $columnaCsv))) {
                $documentos[] = $tipo;
            }
        }

        // Beneficiarios por rango de edad.
        $beneficiarios = [];
        foreach (COLUMNAS_BENEFICIARIO as $rango => [$colH, $colM]) {
            $h = (int) ($valor($cruda, $colH) ?? 0);
            $m = (int) ($valor($cruda, $colM) ?? 0);
            if ($h > 0 || $m > 0) {
                $beneficiarios[] = ['rango' => $rango, 'hombres' => $h, 'mujeres' => $m];
            }
        }

        $filas[] = [
            'linea'         => $numero,
            'osc'           => $osc,
            'municipio'     => $valor($cruda, 'municipio'),
            'documentos'    => $documentos,
            'beneficiarios' => $beneficiarios,
        ];
    }
    fclose($fh);

    // Columnas del archivo que este importador no conoce. No es un error, pero
    // conviene mostrarlo: si la dependencia agrega un campo, aquí se entera.
    $conocidas = array_merge(
        array_keys(COLUMNAS_OSC), COLUMNAS_CORREO,
        array_keys(COLUMNAS_DOCUMENTO), ['municipio', 'coordenadas'],
        array_merge(...array_values(COLUMNAS_BENEFICIARIO)),
        ['numerobeneficiarios', 'numerobeneficiariostotales',
         'beneficiarioshombres', 'beneficiariosmujeres'],
        array_map(fn($k) => normalizarEncabezado($k),
                  ['Año_Declaracion_Anual', 'Año_Dicamen_Fiscal', 'Año_Acreditacion_Donataria',
                   'Año_Fciha_Visita', 'Año_Plan_Trabajo'])
    );
    $ignoradas = [];
    foreach ($indice as $clave => $_) {
        if ($clave !== '' && !in_array($clave, $conocidas, true)) {
            $ignoradas[] = $clave;
        }
    }

    return ['filas' => $filas, 'advertencias' => $advertencias, 'columnas_ignoradas' => $ignoradas];
}

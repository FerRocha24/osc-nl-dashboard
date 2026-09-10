<?php
// POST /endpoints/padron-importar.php   (multipart/form-data)
//   campos: archivo, confirmar ("1" para escribir; ausente = solo vista previa)
//
// Importa el padrón desde el CSV que usa la Secretaría.
//
// Funciona en dos pasos a propósito. Sin confirmar, analiza el archivo y
// reporta qué haría: cuántas organizaciones crearía, cuántas actualizaría y
// qué filas tienen problemas. Solo con `confirmar=1` escribe.
//
// Actualiza, nunca reemplaza: las organizaciones que estén en la base pero no
// en el archivo se quedan intactas. Importar no da de baja a nadie.

require_once __DIR__ . '/../config/api.php';
require_once __DIR__ . '/../config/importador.php';

ejecutar(function () use ($pdo) {
    $confirmar = ($_POST['confirmar'] ?? '') === '1';
    $archivo = $_FILES['archivo'] ?? null;

    if (!$archivo || ($archivo['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        responderError('No se recibió ningún archivo.', 422);
    }
    if (!is_uploaded_file($archivo['tmp_name'])) {
        responderError('Archivo inválido.', 422);
    }

    try {
        $analisis = analizarCsv($archivo['tmp_name']);
    } catch (RuntimeException $e) {
        responderError($e->getMessage(), 422);
    }

    $filas = $analisis['filas'];
    if ($filas === []) {
        responderError('El archivo no contiene filas con datos.', 422);
    }

    // ---- Qué organizaciones ya existen -------------------------------------
    // Se empareja por no_registro (el ID_Organizacion del archivo). Es lo que
    // hace la importación idempotente: subir dos veces el mismo archivo
    // actualiza en lugar de duplicar el padrón.
    $folios = array_values(array_filter(array_map(
        fn($f) => $f['osc']['no_registro'] ?? null, $filas
    )));

    $existentes = [];
    if ($folios) {
        $marcadores = implode(',', array_fill(0, count($folios), '?'));
        $stmt = $pdo->prepare("SELECT no_registro, id_osc FROM OSC WHERE no_registro IN ($marcadores)");
        $stmt->execute($folios);
        foreach ($stmt->fetchAll() as $f) {
            $existentes[$f['no_registro']] = (int) $f['id_osc'];
        }
    }

    $sinFolio = count($filas) - count($folios);
    $aActualizar = count($existentes);
    $aCrear = count($filas) - $aActualizar - $sinFolio;

    $resumen = [
        'filas_leidas'        => count($filas),
        'se_crearian'         => $aCrear,
        'se_actualizarian'    => $aActualizar,
        'sin_identificador'   => $sinFolio,
        'advertencias'        => $analisis['advertencias'],
        'columnas_ignoradas'  => $analisis['columnas_ignoradas'],
        'con_ubicacion'       => count(array_filter($filas, fn($f) => ($f['osc']['latitud'] ?? null) !== null)),
        'documentos_marcados' => array_sum(array_map(fn($f) => count($f['documentos']), $filas)),
    ];

    if (!$confirmar) {
        // Vista previa: se muestran las tres primeras filas ya interpretadas
        // para que se pueda verificar que las columnas se leyeron bien.
        $resumen['muestra'] = array_map(fn($f) => [
            'linea'     => $f['linea'],
            'razon_social' => $f['osc']['razon_social'] ?? null,
            'no_registro'  => $f['osc']['no_registro'] ?? null,
            'municipio'    => $f['municipio'],
            'rubro_general'=> $f['osc']['rubro_general'] ?? null,
            'estatus'      => $f['osc']['estatus_operacion'] ?? null,
            'documentos'   => count($f['documentos']),
        ], array_slice($filas, 0, 3));
        $resumen['confirmado'] = false;
        return $resumen;
    }

    // ---- Escritura ---------------------------------------------------------
    // Todo dentro de una transacción: si algo falla a la mitad, no queda un
    // padrón medio actualizado que nadie sabe en qué estado está.
    $pdo->beginTransaction();
    try {
        $municipios = [];
        foreach ($pdo->query('SELECT id_municipio, nombre_municipio FROM Municipio')->fetchAll() as $m) {
            $municipios[normalizarEncabezado($m['nombre_municipio'])] = (int) $m['id_municipio'];
        }
        $insertarMunicipio = $pdo->prepare('INSERT INTO Municipio (nombre_municipio) VALUES (:n)');

        $creadas = $actualizadas = 0;

        foreach ($filas as $f) {
            $osc = $f['osc'];

            // Municipio: si viene uno que no está en el catálogo, se da de alta
            // en lugar de perder la referencia geográfica de esa organización.
            $idMunicipio = null;
            if ($f['municipio']) {
                $clave = normalizarEncabezado($f['municipio']);
                if (!isset($municipios[$clave])) {
                    $insertarMunicipio->execute([':n' => $f['municipio']]);
                    $municipios[$clave] = (int) $pdo->lastInsertId();
                }
                $idMunicipio = $municipios[$clave];
            }
            if ($idMunicipio !== null) {
                $osc['id_municipio'] = $idMunicipio;
            }

            // Una coordenada del archivo es el domicilio verificado por la
            // Secretaría, así que pisa a la calculada de la dirección. Marcarla
            // aquí es lo que hace que no se vuelvan a confundir nunca.
            if (($osc['latitud'] ?? null) !== null && ($osc['longitud'] ?? null) !== null) {
                $osc['origen_coordenada'] = 'padron';
            }

            $folio = $osc['no_registro'] ?? null;
            $idOsc = ($folio !== null && isset($existentes[$folio])) ? $existentes[$folio] : null;

            if ($idOsc === null) {
                $campos = array_keys($osc);
                $sql = 'INSERT INTO OSC (' . implode(', ', $campos) . ') VALUES (:' . implode(', :', $campos) . ')';
                $stmt = $pdo->prepare($sql);
                foreach ($osc as $c => $v) {
                    $stmt->bindValue(":$c", $v);
                }
                $stmt->execute();
                $idOsc = (int) $pdo->lastInsertId();
                $creadas++;
            } else {
                // Solo se tocan las columnas que el archivo trae con valor. Un
                // campo vacío en el CSV no borra lo que ya estaba capturado.
                $asignaciones = [];
                foreach ($osc as $c => $v) {
                    if ($v !== null && $c !== 'no_registro') {
                        $asignaciones[] = "$c = :$c";
                    }
                }
                if ($asignaciones) {
                    $stmt = $pdo->prepare('UPDATE OSC SET ' . implode(', ', $asignaciones) . ' WHERE id_osc = :id_osc');
                    foreach ($osc as $c => $v) {
                        if ($v !== null && $c !== 'no_registro') {
                            $stmt->bindValue(":$c", $v);
                        }
                    }
                    $stmt->bindValue(':id_osc', $idOsc, PDO::PARAM_INT);
                    $stmt->execute();
                }
                $actualizadas++;
            }

            // Beneficiarios: se reemplazan los de esa OSC, porque el archivo
            // trae el total vigente y no un incremento.
            if ($f['beneficiarios']) {
                $pdo->prepare('DELETE FROM Beneficiarios WHERE id_osc = :id')
                    ->execute([':id' => $idOsc]);
                $ins = $pdo->prepare(
                    'INSERT INTO Beneficiarios (id_osc, rango_edad, num_hombres, num_mujeres)
                     VALUES (:id, :rango, :h, :m)'
                );
                foreach ($f['beneficiarios'] as $b) {
                    $ins->execute([':id' => $idOsc, ':rango' => $b['rango'],
                                   ':h' => $b['hombres'], ':m' => $b['mujeres']]);
                }
            }

            // Documentos: el archivo indica que el documento existe en el
            // expediente físico, no lo adjunta. Se crea el registro sin archivo
            // para que el personal pueda subir el PDF después.
            //
            // No se duplica: si ya hay un registro de ese tipo para esa OSC se
            // respeta, porque podría tener un archivo adjunto y un estatus de
            // revisión que este archivo no conoce.
            if ($f['documentos']) {
                $existeDoc = $pdo->prepare(
                    'SELECT 1 FROM Documentacion WHERE id_osc = :id AND tipo_documento = :tipo'
                );
                $insDoc = $pdo->prepare(
                    "INSERT INTO Documentacion (id_osc, tipo_documento, estatus_validacion, fecha_entrega)
                     VALUES (:id, :tipo, 'Completo', CURDATE())"
                );
                foreach ($f['documentos'] as $tipo) {
                    $existeDoc->execute([':id' => $idOsc, ':tipo' => $tipo]);
                    if (!$existeDoc->fetchColumn()) {
                        $insDoc->execute([':id' => $idOsc, ':tipo' => $tipo]);
                    }
                }
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }

    $resumen['confirmado']   = true;
    $resumen['creadas']      = $creadas;
    $resumen['actualizadas'] = $actualizadas;

    // Fuera de la transacción: si la bitácora fallara, la importación ya
    // ocurrió y revertirla por no poder anotarla sería el peor de los mundos.
    registrarBitacora($pdo, 'padron.importar', [
        'detalle' => "$creadas organizaciones creadas y $actualizadas actualizadas "
            . 'desde ' . ($archivo['name'] ?? 'un archivo CSV'),
    ]);

    return $resumen;
}, ['POST'], roles: ['admin']);

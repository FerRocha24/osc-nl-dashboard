<?php
// Carga de variables de entorno desde un archivo .env.
//
// Se parsea en PHP (no con el shell) a propósito: la contraseña de RDS
// contiene caracteres especiales que rompen `export $(cat .env | xargs)`.
//
// Orden de búsqueda:
//   1. Variables ya presentes en el entorno del servidor (producción RHEL/Apache)
//   2. backend/.env
//   3. database/.env   (el que ya existe en este repo)

function cargarEnv(): void
{
    static $cargado = false;
    if ($cargado) {
        return;
    }
    $cargado = true;

    $rutas = [
        __DIR__ . '/../.env',
        __DIR__ . '/../../database/.env',
    ];

    foreach ($rutas as $ruta) {
        if (!is_readable($ruta)) {
            continue;
        }

        foreach (file($ruta, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) as $linea) {
            $linea = trim($linea);
            if ($linea === '' || str_starts_with($linea, '#')) {
                continue;
            }

            $partes = explode('=', $linea, 2);
            if (count($partes) !== 2) {
                continue;
            }

            $clave = trim($partes[0]);
            $valor = trim($partes[1]);

            // Quita comillas envolventes si las hay
            $largo = strlen($valor);
            if ($largo >= 2) {
                $primero = $valor[0];
                $ultimo = $valor[$largo - 1];
                if (($primero === '"' && $ultimo === '"') || ($primero === "'" && $ultimo === "'")) {
                    $valor = substr($valor, 1, -1);
                }
            }

            // Las variables reales del servidor siempre ganan sobre el .env
            if (getenv($clave) === false) {
                putenv("$clave=$valor");
                $_ENV[$clave] = $valor;
            }
        }
    }
}

// Lee una variable de entorno con valor por defecto opcional.
//
// Se consultan tres fuentes porque no todas funcionan en todos los montajes:
// cuando PHP corre bajo php-fpm (lo normal en RHEL + Apache), las variables
// que Apache define con `SetEnv` NO las ve getenv() — llegan como parámetros
// FastCGI y aparecen en $_SERVER. Con mod_php sí las ve getenv(). Revisar las
// tres evita que el backend funcione en local y falle en el servidor sin una
// razón visible.
function env(string $clave, ?string $porDefecto = null): ?string
{
    cargarEnv();

    $valor = getenv($clave);
    if ($valor === false || $valor === '') {
        $valor = $_SERVER[$clave] ?? $_ENV[$clave] ?? false;
    }

    return ($valor === false || $valor === '') ? $porDefecto : $valor;
}

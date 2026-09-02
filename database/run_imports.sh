#!/bin/bash
# Aplica las migraciones 008 (tabla Apoyos) y 009 (campos de contacto en OSC)
# y después importa los datos reales: municipios, padrón de OSC e historial
# de apoyos.
#
# Requiere haber corrido antes ./run_migrations.sh (las 7 tablas base) y
# tener el .env configurado en esta misma carpeta (database/).
#
# Uso:
#   ./run_imports.sh              # importación normal (base sin datos)
#   ./run_imports.sh --reimport   # borra los datos importados y vuelve a cargarlos

set -euo pipefail
cd "$(dirname "$0")"
source ./_env.sh

REIMPORT=0
[ "${1:-}" = "--reimport" ] && REIMPORT=1

cargar_env .env
validar_env
crear_cnf
trap 'rm -f "$CNF"' EXIT

# Los municipios 1-9 los sembró la migración 001; del 10 en adelante vienen
# del archivo de importación. Se usa como frontera al reimportar.
readonly MUNICIPIOS_SEMBRADOS=9

consulta() { mysql --defaults-extra-file="$CNF" -N -B -e "$1"; }

echo "Conectando a $DB_HOST / base de datos $DB_NAME..."

# --- Migraciones, solo si faltan -------------------------------------------
existe_tabla_apoyos=$(consulta "SELECT COUNT(*) FROM information_schema.TABLES
    WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='Apoyos';")
if [ "$existe_tabla_apoyos" -eq 0 ]; then
  echo "Aplicando migración 008 (tabla Apoyos)..."
  mysql --defaults-extra-file="$CNF" < migrations/008_create_apoyos.sql
else
  echo "Migración 008 ya aplicada (la tabla Apoyos existe), se omite."
fi

existe_columna_alias=$(consulta "SELECT COUNT(*) FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA='$DB_NAME' AND TABLE_NAME='OSC' AND COLUMN_NAME='alias';")
if [ "$existe_columna_alias" -eq 0 ]; then
  echo "Aplicando migración 009 (campos de contacto en OSC)..."
  mysql --defaults-extra-file="$CNF" < migrations/009_alter_osc_contact_fields.sql
else
  echo "Migración 009 ya aplicada (la columna OSC.alias existe), se omite."
fi

# --- Protección contra doble importación -----------------------------------
# 02_import_osc.sql usa INSERT (no INSERT IGNORE) y razon_social no tiene
# índice único, así que correrlo dos veces duplicaría el padrón en vez de
# fallar. Con --reimport se limpia primero.
ya_hay=$(consulta "SELECT COUNT(*) FROM OSC;")
if [ "$ya_hay" -gt 0 ]; then
  if [ "$REIMPORT" -eq 0 ]; then
    echo ""
    echo "ABORTADO: la tabla OSC ya tiene $ya_hay registros."
    echo "Volver a importar duplicaría el padrón. Si quieres recargar los datos"
    echo "desde cero, corre:  ./run_imports.sh --reimport"
    exit 1
  fi

  echo ""
  echo "--reimport: borrando datos importados ($ya_hay OSC)..."
  # Apoyos va primero por la llave foránea hacia OSC.
  mysql --defaults-extra-file="$CNF" <<EOF
DELETE FROM Apoyos;
DELETE FROM OSC;
DELETE FROM Municipio WHERE id_municipio > $MUNICIPIOS_SEMBRADOS;
ALTER TABLE Apoyos    AUTO_INCREMENT = 1;
ALTER TABLE OSC       AUTO_INCREMENT = 1;
ALTER TABLE Municipio AUTO_INCREMENT = $((MUNICIPIOS_SEMBRADOS + 1));
EOF
  echo "Datos previos eliminados."
fi

# --- Importación -----------------------------------------------------------
aplicar() { echo "$1"; mysql --defaults-extra-file="$CNF" < "$2"; }

aplicar "Importando municipios..."                                        imports/01_import_municipios.sql
aplicar "Importando padrón de OSC (779 organizaciones, puede tardar)..."  imports/02_import_osc.sql
aplicar "Importando historial de apoyos (598 registros)..."               imports/03_import_apoyos.sql

echo ""
echo "Listo. Importación completa."
echo "Verificando conteos..."
mysql --defaults-extra-file="$CNF" --table -e "
SELECT
  (SELECT COUNT(*) FROM Municipio) AS municipios,
  (SELECT COUNT(*) FROM OSC)       AS osc,
  (SELECT COUNT(*) FROM Apoyos)    AS apoyos,
  (SELECT COUNT(*) FROM Apoyos WHERE id_osc IS NOT NULL) AS apoyos_emparejados,
  (SELECT COUNT(*) FROM OSC WHERE id_municipio IS NULL)  AS osc_sin_municipio;
"

# Verifica que los acentos no hayan quedado doblemente codificados (el error
# clásico de importar un .sql UTF-8 con el cliente en latin1: "García" se
# guarda como "GarcÃ­a"). La firma en bytes es C383, que es "Ã" en UTF-8.
#
# Se busca sobre HEX() y no con LIKE '%Ã%' porque la colación utf8mb4_0900_ai_ci
# ignora los acentos: un LIKE normal daría por bueno cualquier "a" y reportaría
# casi todas las filas como corruptas.
echo "Verificando codificación (todo debe salir en 0)..."
mysql --defaults-extra-file="$CNF" --table -e "
SELECT
  (SELECT COUNT(*) FROM OSC       WHERE HEX(razon_social)     LIKE '%C383%') AS osc_mal_codificadas,
  (SELECT COUNT(*) FROM Municipio WHERE HEX(nombre_municipio) LIKE '%C383%') AS municipios_mal_codificados,
  (SELECT COUNT(*) FROM Apoyos    WHERE HEX(nombre_organizacion_original) LIKE '%C383%') AS apoyos_mal_codificados;
"

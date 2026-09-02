#!/bin/bash
# Corre las 9 migraciones en orden contra la base de datos RDS.
#
# OJO: las migraciones NO son idempotentes (un CREATE TABLE sobre una tabla
# que ya existe falla). Este script es para inicializar una base vacía.
#
# Uso:
#   1. Copia .env.example a .env y llena tus credenciales de RDS
#   2. chmod +x run_migrations.sh
#   3. ./run_migrations.sh

set -euo pipefail
cd "$(dirname "$0")"
source ./_env.sh

cargar_env .env
validar_env
crear_cnf
trap 'rm -f "$CNF"' EXIT

echo "Conectando a $DB_HOST / base de datos $DB_NAME..."

for file in migrations/*.sql; do
  echo "Ejecutando $file..."
  mysql --defaults-extra-file="$CNF" < "$file"
done

echo "Listo. Todas las migraciones se ejecutaron correctamente."

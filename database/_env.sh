#!/bin/bash
# Funciones compartidas por run_migrations.sh y run_imports.sh.
# No se ejecuta directo; se carga con `source _env.sh`.

# Carga el archivo .env línea por línea.
#
# ¿Por qué no `export $(cat .env | xargs)`? Porque la contraseña de RDS trae
# caracteres especiales (<, >, $, comillas...) que el shell interpretaría,
# rompiendo la carga o corrompiendo el valor silenciosamente.
cargar_env() {
  local archivo="$1" linea clave valor largo
  [ -f "$archivo" ] || return 0

  while IFS= read -r linea || [ -n "$linea" ]; do
    # Ignora líneas en blanco y comentarios
    linea="${linea#"${linea%%[![:space:]]*}"}"
    [ -z "$linea" ] && continue
    case "$linea" in \#*) continue ;; *=*) ;; *) continue ;; esac

    clave="${linea%%=*}"
    valor="${linea#*=}"

    # Quita espacios de la clave y comillas envolventes del valor
    clave="${clave//[[:space:]]/}"
    largo=${#valor}
    if [ "$largo" -ge 2 ]; then
      case "$valor" in
        \"*\") valor="${valor:1:largo-2}" ;;
        \'*\') valor="${valor:1:largo-2}" ;;
      esac
    fi

    export "$clave=$valor"
  done < "$archivo"
}

# Valida que estén las variables mínimas de conexión.
validar_env() {
  if [ -z "${DB_HOST:-}" ] || [ -z "${DB_USER:-}" ] || [ -z "${DB_NAME:-}" ]; then
    echo "Error: faltan variables DB_HOST, DB_USER o DB_NAME en .env"
    echo "Copia .env.example a .env y llena tus datos de conexión."
    exit 1
  fi
}

# Crea un archivo de credenciales temporal con permisos 600 y deja su ruta
# en la variable CNF.
#
# ¿Por qué no `-p"$DB_PASSWORD"`? Porque deja la contraseña visible en la
# lista de procesos (ps aux) para cualquier usuario de la máquina.
crear_cnf() {
  CNF="$(mktemp)"
  chmod 600 "$CNF"
  cat > "$CNF" <<EOF
[client]
host=${DB_HOST}
user=${DB_USER}
password="${DB_PASSWORD:-}"
database=${DB_NAME}
connect-timeout=15
# IMPRESCINDIBLE: el cliente de MySQL usa latin1 por defecto en esta máquina.
# Sin esta línea, los archivos .sql (que están en UTF-8) se mandan al servidor
# declarados como latin1 y cada acento termina doblemente codificado:
# "García" se guarda como "GarcÃ­a". Rompe los 779 nombres del padrón.
default-character-set=utf8mb4
EOF
}

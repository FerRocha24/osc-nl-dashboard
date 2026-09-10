#!/bin/bash
# Saca la configuración del tablero fuera de los VirtualHost.
#
# POR QUÉ: las variables (credenciales de base, clave de firma, rutas) vivían
# dentro del VirtualHost que Certbot regenera en cada renovación del
# certificado. Cuando eso pasa, la aplicación pierde su configuración meses
# después y sin relación aparente con nada. Ya ocurrió una vez con los permisos
# del archivo, y ARCHIVOS_DIR simplemente nunca llegó a estar.
#
# QUÉ HACE: mueve todos los SetEnv a /etc/httpd/conf.d/osc-api-env.conf, que
# Certbot no toca porque no es un VirtualHost, y deja en cada vhost una línea
# que lo incluye.
#
# Es idempotente: correrlo dos veces no rompe nada.
#
# Uso, desde la máquina de desarrollo:
#   ssh -i llave.pem usuario@servidor 'sudo bash -s' < backend/deploy/migrar-config.sh

set -euo pipefail

CONF_DIR="${CONF_DIR:-/etc/httpd/conf.d}"
ENV_FILE="$CONF_DIR/osc-api-env.conf"
RAIZ="${RAIZ:-/var/www/osc-api}"
ARCHIVOS="${ARCHIVOS:-/var/osc-archivos}"
SELLO=$(date +%Y%m%d-%H%M%S)

echo "== Buscando los VirtualHost del tablero =="
VHOSTS=$(grep -l "DocumentRoot $RAIZ" "$CONF_DIR"/*.conf 2>/dev/null || true)
if [ -z "$VHOSTS" ]; then
  echo "ERROR: ningún archivo en $CONF_DIR apunta a $RAIZ" >&2
  exit 1
fi
echo "$VHOSTS" | sed 's/^/   /'

# ---- Respaldo antes de tocar nada -----------------------------------------
echo
echo "== Respaldando =="
for v in $VHOSTS; do
  cp -p "$v" "$v.respaldo-$SELLO"
  echo "   $v.respaldo-$SELLO"
done

restaurar() {
  echo "Restaurando el respaldo..." >&2
  for v in $VHOSTS; do cp -p "$v.respaldo-$SELLO" "$v"; done
}

# ---- Reunir las variables --------------------------------------------------
# Se recogen de los vhosts y del archivo destino si ya existía. La última
# definición de cada nombre gana, que es como las interpreta Apache.
echo
echo "== Reuniendo variables =="
TMP=$(mktemp)
{ [ -f "$ENV_FILE" ] && cat "$ENV_FILE"; cat $VHOSTS; } 2>/dev/null \
  | grep -E "^[[:space:]]*SetEnv[[:space:]]+[A-Z_]+" \
  | sed -E 's/^[[:space:]]*//' > "$TMP" || true

# Deduplica por nombre de variable conservando la última aparición.
awk '{ orden[$2] = NR; linea[$2] = $0 }
     END { for (v in linea) print orden[v] "\t" linea[v] }' "$TMP" \
  | sort -n | cut -f2- > "$TMP.limpio"

# ARCHIVOS_DIR es la que faltaba: si no está en ninguna parte, se agrega.
if ! grep -q "SetEnv ARCHIVOS_DIR" "$TMP.limpio"; then
  echo "SetEnv ARCHIVOS_DIR $ARCHIVOS" >> "$TMP.limpio"
  echo "   ARCHIVOS_DIR no estaba: se agrega"
fi
echo "   variables encontradas: $(wc -l < "$TMP.limpio")"
cut -d' ' -f2 "$TMP.limpio" | sed 's/^/      /'

if [ ! -s "$TMP.limpio" ]; then
  echo "ERROR: no se encontró ninguna variable; no se cambia nada" >&2
  exit 1
fi

# ---- Escribir el archivo de configuración ---------------------------------
echo
echo "== Escribiendo $ENV_FILE =="
{
  echo "# Configuración del Tablero OSC NL."
  echo "#"
  echo "# Vive FUERA de los VirtualHost a propósito: Certbot los regenera en cada"
  echo "# renovación del certificado y se llevaría estas variables por delante."
  echo "#"
  echo "# CONTIENE CREDENCIALES. Debe quedar en modo 600 y propiedad de root."
  echo "# Generado por migrar-config.sh el $(date +%F' '%T)."
  echo
  cat "$TMP.limpio"
} > "$ENV_FILE"

chown root:root "$ENV_FILE"
chmod 600 "$ENV_FILE"
rm -f "$TMP" "$TMP.limpio"
echo "   $(ls -l "$ENV_FILE" | awk '{print $1, $3, $4}')"

# ---- Dejar los vhosts incluyéndolo ----------------------------------------
echo
echo "== Actualizando los VirtualHost =="
# Se usa awk y no sed -i: sed difiere entre GNU y BSD justo en la edición en
# sitio y en los grupos de captura, y este script tiene que poder probarse en
# la máquina de desarrollo antes de correrlo contra el servidor.
for v in $VHOSTS; do
  YA=$(grep -c "IncludeOptional $ENV_FILE" "$v" || true)

  awk -v env_file="$ENV_FILE" -v raiz="$RAIZ" -v ya="$YA" '
    {
      linea = $0
      # Los SetEnv se comentan en vez de borrarse: si algo saliera mal, el
      # valor sigue a la vista y no hay que recuperarlo del respaldo.
      if (linea ~ /^[ \t]*SetEnv[ \t]+[A-Z_]+/) {
        sub(/SetEnv/, "# movido a osc-api-env.conf: SetEnv", linea)
      }
      print linea
      # El include va justo después del DocumentRoot, dentro del VirtualHost:
      # fuera de él, las variables no aplicarían a las peticiones.
      if (ya == 0 && linea ~ ("DocumentRoot[ \t]+" raiz "[ \t]*$")) {
        print "    IncludeOptional " env_file
      }
    }
  ' "$v" > "$v.nuevo"

  # Se reemplaza solo si el resultado no quedó vacío: un awk que fallara a la
  # mitad dejaría el vhost en blanco y el servidor sin sitio.
  if [ -s "$v.nuevo" ]; then
    cat "$v.nuevo" > "$v"
    rm -f "$v.nuevo"
    [ "$YA" = "0" ] && echo "   $v: include agregado" || echo "   $v: ya tenía el include"
  else
    rm -f "$v.nuevo"
    restaurar
    echo "ERROR: la reescritura de $v quedó vacía; se restauró el respaldo" >&2
    exit 1
  fi
done

# ---- Verificar antes de recargar ------------------------------------------
echo
echo "== Verificando la configuración =="
if ! apachectl configtest; then
  restaurar
  echo "La configuración quedó inválida; se restauró el respaldo y NO se recargó." >&2
  exit 1
fi

systemctl reload httpd
echo
echo "Listo. Apache recargado."
echo "Respaldos en $CONF_DIR/*.respaldo-$SELLO (bórralos cuando confirmes que todo funciona)."

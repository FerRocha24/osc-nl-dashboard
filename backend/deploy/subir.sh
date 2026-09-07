#!/bin/bash
# Copia el backend a la EC2 por rsync.
#
# Uso:
#   ./subir.sh ec2-user@1.2.3.4 [~/.ssh/tu-llave.pem]
#
# Sube solo el código: excluye .env y todo lo local. Las credenciales viven en
# el VirtualHost de Apache (ver osc-api.conf), no en un archivo subido.

set -euo pipefail

DESTINO="${1:-}"
LLAVE="${2:-}"
RUTA_REMOTA="/var/www/osc-api"

if [ -z "$DESTINO" ]; then
  echo "Uso: ./subir.sh usuario@host [ruta/a/llave.pem]"
  exit 1
fi

cd "$(dirname "$0")/.."   # backend/

SSH="ssh"
[ -n "$LLAVE" ] && SSH="ssh -i $LLAVE"

echo "Subiendo backend a $DESTINO:$RUTA_REMOTA ..."

# --delete deja el servidor idéntico a lo local: si borraste un endpoint aquí,
# también desaparece allá. Las exclusiones evitan mandar credenciales.
#
# --rsync-path="sudo rsync": el directorio remoto pertenece a apache (para que
# el servidor web pueda leer el código), y quien se conecta es ec2-user. Sin
# esto, rsync falla con "Permission denied" a media transferencia y deja el
# servidor con la versión anterior.
#
# Los documentos subidos por las personas usuarias NO están en riesgo: viven en
# /var/osc-archivos, fuera de este directorio, precisamente para que Apache no
# pueda servirlos directo.
rsync -avz --delete \
  -e "$SSH" \
  --rsync-path="sudo rsync" \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'deploy/' \
  --exclude '.DS_Store' \
  ./ "$DESTINO:$RUTA_REMOTA/"

# Los pasos de después van aquí y no impresos como recordatorio: olvidar el
# chown deja a Apache sin poder leer el código nuevo, y responde 500 en vez de
# funcionar. El configtest corre ANTES del reload para no tumbar el servidor
# con una configuración rota.
echo ""
echo "Ajustando permisos y recargando Apache ..."
$SSH "$DESTINO" "sudo chown -R apache:apache $RUTA_REMOTA \
  && sudo apachectl configtest \
  && sudo systemctl reload httpd"

echo ""
echo "Listo." 

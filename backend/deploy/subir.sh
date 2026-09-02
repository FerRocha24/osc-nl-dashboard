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
rsync -avz --delete \
  -e "$SSH" \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude 'deploy/' \
  --exclude '.DS_Store' \
  ./ "$DESTINO:$RUTA_REMOTA/"

echo ""
echo "Listo. En el servidor:"
echo "  sudo chown -R apache:apache $RUTA_REMOTA"
echo "  sudo apachectl configtest && sudo systemctl reload httpd"

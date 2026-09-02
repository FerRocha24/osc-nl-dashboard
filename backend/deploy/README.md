# deploy/

Plantillas para montar el backend en la EC2. Ver `DEPLOY.md` en la raíz del
repositorio para el procedimiento completo.

| Archivo | Qué es |
|---|---|
| `osc-api.conf` | VirtualHost de Apache con las variables de entorno |
| `subir.sh` | Copia `backend/` al servidor por rsync |

Ninguno de los dos contiene credenciales reales: los valores marcados como
`RELLENAR` se completan directamente en el servidor.

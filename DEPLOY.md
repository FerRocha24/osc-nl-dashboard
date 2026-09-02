# Despliegue

Arquitectura: **base de datos y backend en AWS, frontend en Vercel.**

```
Navegador ──HTTPS──> Vercel (React estático)
    │
    └────HTTPS──> EC2: Apache + PHP 8.5  ──VPC privada──> RDS MySQL 8.4
```

La pieza importante es que la EC2 viva en la **misma VPC** que la RDS
(`us-east-1`). Eso permite cerrar la base a internet, que hoy es la mayor
exposición del proyecto.

---

## 1. Backend en AWS (EC2)

### Por qué EC2 y no Lambda ni un runtime de PHP en Vercel

- La instancia RDS tiene `max_connections = 61`. Cada petición de PHP abre una
  conexión PDO nueva y no hay pooling, así que un backend serverless que escala
  a decenas de instancias agota el límite.
- Producción del socio formador es RHEL 9.7 + Apache + PHP 8.5.9. Una EC2 con
  AMI de RHEL 9 reproduce ese entorno, y la migración final se vuelve copiar
  una carpeta.

### Requisitos del servidor

El backend pesa 84 KB y **no usa Composer ni dependencias externas**. Solo
necesita PHP con `pdo_mysql` (`json` y `pcre` vienen de fábrica):

```bash
sudo dnf install -y httpd php php-mysqlnd
sudo systemctl enable --now httpd
```

Copia `backend/` al servidor (por ejemplo a `/var/www/osc-api`) y apunta ahí un
VirtualHost. Los endpoints quedan bajo `/endpoints/`.

### Variables de entorno

No subas un `.env` al servidor: defínelas en la configuración de Apache
(`SetEnv` en el VirtualHost) o en el `EnvironmentFile` del servicio.

| Variable | Para qué |
|---|---|
| `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Conexión a RDS |
| `APP_SECRET` | Firma de los tokens. `php -r "echo bin2hex(random_bytes(32));"` |
| `AUTH_USUARIO` | Usuario del tablero |
| `AUTH_PASSWORD_HASH` | `php -r "echo password_hash('TU-PASSWORD', PASSWORD_BCRYPT);"` |
| `AUTH_HORAS_VIGENCIA` | Duración de la sesión (por defecto 12) |
| `CORS_ORIGENES` | Dominio de Vercel, p. ej. `https://osc-nl.vercel.app` |

`CORS_ORIGENES` vacío equivale a `*`, que **solo debe usarse en local**.

### Cerrar la base

Una vez que la EC2 se conecte a la RDS:

1. En el security group de la RDS, deja una sola regla de entrada al puerto
   3306 con origen **el security group de la EC2** (no un rango de IPs).
2. Pon la instancia RDS en `Publicly accessible = No`.
3. Verifica que los backups automáticos estén activos.

Hoy la RDS resuelve a una IP pública, así que este paso no es opcional.

### HTTPS

El token viaja en la cabecera `Authorization`. Sin HTTPS va en claro. Instala
un certificado (Let's Encrypt con `certbot`, o un ALB con ACM delante).

---

## 2. Frontend en Vercel

El repositorio incluye `frontend/vercel.json` con la configuración lista.
En Vercel:

- **Root Directory:** `frontend`
- **Framework Preset:** Vite (lo detecta solo)
- **Environment Variable:** `VITE_API_URL` = la URL HTTPS del backend en AWS

`vercel.json` ya incluye el *rewrite* de todas las rutas a `index.html`. Sin él,
entrar directo a `/estrategica` daría 404, porque el enrutamiento lo hace React
en el navegador y Vercel buscaría un archivo con ese nombre.

Después del primer deploy, pon el dominio que te asigne Vercel en
`CORS_ORIGENES` del backend y reinicia Apache.

---

## 3. Datos

Los `.sql` de importación **no están en el repositorio**: contienen 1,237
correos y 759 teléfonos de personas reales del padrón. Se generan a partir de
los CSV originales, que se comparten por un canal privado:

```bash
python3 database/imports/generate_imports.py --csv-dir /ruta/a/los/csv
cd database && ./run_imports.sh
```

`run_imports.sh` aborta si ya hay datos; usa `--reimport` para recargar.

---

## Antes de dar acceso a alguien más

- [ ] `CORS_ORIGENES` apuntando al dominio real, no vacío
- [ ] HTTPS activo en el backend
- [ ] RDS con `Publicly accessible = No` y backups encendidos
- [ ] `APP_SECRET` distinto del de desarrollo
- [ ] Contraseña del tablero distinta de la de desarrollo
- [ ] Repositorio en **privado** (aunque los datos ya no estén dentro)

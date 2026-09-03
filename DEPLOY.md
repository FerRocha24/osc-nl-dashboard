# Despliegue

> **Esta infraestructura en AWS es temporal.** Sirve para demostrar el tablero
> funcionando de punta a punta. El destino final es el servidor del socio
> formador (RHEL 9.7 + Apache + PHP 8.5.9); la sección
> [Migrar al servidor definitivo](#migrar-al-servidor-definitivo) explica ese paso.

## Estado actual (demo en línea)

| Pieza | Dónde | URL |
|---|---|---|
| Frontend | Vercel | https://osc-nl-dashboard.vercel.app |
| API | EC2 `osc-nl-api` | https://osc-nl.duckdns.org |
| Base de datos | RDS `osc-nl-db` | privada, dentro de la VPC |

Acceso al tablero: usuario `admin`, contraseña definida en `AUTH_PASSWORD_HASH`
del VirtualHost (no está en el repositorio).

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

## Infraestructura actual

Datos verificados en la consola, para no tener que buscarlos otra vez:

| | |
|---|---|
| Región | `us-east-1` (N. Virginia) |
| VPC | `vpc-03208f2b79e7369eb` |
| Instancia RDS | `osc-nl-db` · MySQL 8.4.9 · `db.t3.micro` |
| Zona de la RDS | `us-east-1f` |
| Security group de la RDS | `osc-nl-db-sg` (`sg-0976de69fada0ce9c`) |
| Backups automáticos | 7 días de retención |
| `max_connections` | 61 |
| **Frontend (Vercel)** | **https://osc-nl-dashboard.vercel.app** |

El proyecto de Vercel está configurado con Root Directory `frontend`, preset
Vite y la variable `VITE_API_URL`. Cada push a `main` redespliega solo.

La EC2 tiene que ir en **esa misma VPC** para hablarle a la base por red
privada. Conviene ponerla en `us-east-1f` para no pagar tráfico entre zonas.

### Acceso actual a la base

El security group solo acepta la IP de la máquina de desarrollo. Como las IP
domésticas son dinámicas, **cuando cambie se pierde el acceso** y hay que
actualizar la regla (*Edit inbound rules* → Source → *My IP*). En cuanto la
EC2 esté funcionando esto deja de importar, porque el acceso pasa a ser por
red privada.

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

Copia `backend/` al servidor y apunta ahí un VirtualHost. En `backend/deploy/`
hay dos plantillas listas:

```bash
# 1. Sube el código (excluye .env y credenciales)
./backend/deploy/subir.sh ec2-user@LA-IP ~/.ssh/tu-llave.pem

# 2. En el servidor: instala el VirtualHost
sudo cp /var/www/osc-api/deploy/osc-api.conf /etc/httpd/conf.d/
sudo vi /etc/httpd/conf.d/osc-api.conf        # llena los RELLENAR
sudo chmod 600 /etc/httpd/conf.d/osc-api.conf
sudo apachectl configtest && sudo systemctl reload httpd
```

Los endpoints quedan bajo `/endpoints/`. El `.conf` ya bloquea el acceso web a
`config/`, a `deploy/` y a cualquier `.env`.

**Por qué las credenciales van en el VirtualHost y no en un `.env`:** un archivo
subido puede quedar legible por otros usuarios del servidor o colarse en un
backup. En el `.conf` con permisos 600 solo lo lee root y Apache.

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

Una vez que la EC2 se conecte a la RDS y el backend responda desde ahí:

1. En `osc-nl-db-sg`, cambia la regla del puerto 3306: en **Source** elige el
   **security group de la EC2**, no un rango de IPs. Así el permiso sigue a la
   instancia aunque cambie de IP.
2. Pon la instancia RDS en `Publicly accessible = No`.

Hazlo **en ese orden y solo al final**: si cierras la base antes de que la EC2
funcione, te quedas sin acceso desde la máquina de desarrollo y sin forma de
depurar.

✅ Backups: ya están en 7 días de retención, más un snapshot manual con los
datos ya importados (los snapshots manuales no expiran).

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

El dominio asignado es **`https://osc-nl-dashboard.vercel.app`**, y ya está
puesto en `CORS_ORIGENES` dentro de `backend/deploy/osc-api.conf`.

`VITE_API_URL` apunta hoy a `https://pendiente.example.com` (un marcador). En
cuanto la EC2 tenga HTTPS, cámbiala en *Project Settings → Environment
Variables* y **vuelve a desplegar**: Vite incrusta el valor en el bundle
durante el build, así que cambiar la variable sin redesplegar no surte efecto.

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

## Usuarios del tablero

El acceso ya no es una sola cuenta compartida: hay una tabla `Usuario` con tres
roles.

| Rol | Puede |
|---|---|
| `admin` | Todo, incluyendo crear y desactivar cuentas |
| `revisor` | Sube documentos y aprueba o rechaza |
| `consulta` | Solo lectura del tablero |

### Crear la primera cuenta

Mientras la tabla `Usuario` esté vacía, se puede entrar con `AUTH_USUARIO` y
`AUTH_PASSWORD_HASH` del VirtualHost. Es el **modo de arranque**, y deja de
funcionar solo en cuanto existe la primera cuenta.

Para crearla, en el servidor:

```bash
php /var/www/osc-api/deploy/crear-usuario.php
```

Pide los datos y la contraseña sin mostrarla en pantalla. El mismo script sirve
para restablecer la contraseña de alguien que la olvidó.

Después, las cuentas se administran desde el tablero (botón **Usuarios**, solo
visible para administradores).

### Detalles que importan

- Las cuentas **se desactivan, no se borran**: al borrarlas, las revisiones
  firmadas por esa persona se quedarían sin referencia.
- Desactivar surte efecto **de inmediato**, no cuando expire su sesión: el rol
  y el estado se consultan en cada petición.
- El sistema impide quedarse sin ningún administrador activo.
- Cada quien debe cambiar su contraseña en el primer ingreso.

## Migrar al servidor definitivo

Nada de lo que hace funcionar la API depende de AWS. Para llevarla al servidor
del socio formador:

1. **Copiar `backend/`** (84 KB) a `/var/www/osc-api` o donde corresponda. No
   usa Composer ni dependencias externas.
2. **Instalar PHP con `pdo_mysql`.** Requiere **PHP 8.1 o superior** (se usa el
   tipo de retorno `never`). La demo corre en 8.5.9, la misma versión que el
   servidor de producción.
3. **Copiar `deploy/osc-api.conf`** a la configuración de Apache y llenar las
   variables de entorno. Permisos `600`: contiene credenciales.
4. **Apuntar `DB_HOST`** a la base de datos que ellos usen.
5. **Cambiar `CORS_ORIGENES`** al dominio donde quede el frontend.
6. **Certificado TLS.** Sin HTTPS el navegador bloquea las peticiones desde una
   página servida por HTTPS, y el token de sesión viajaría en claro.

El frontend es un sitio estático: `npm run build` en `frontend/` produce `dist/`,
que se puede servir desde cualquier servidor web. Solo necesita `VITE_API_URL`
apuntando a la API **en tiempo de build** (Vite incrusta el valor en el bundle;
cambiarlo después no surte efecto sin reconstruir).

## Al terminar la demo

Para no dejar cargos corriendo:

- **Termina la instancia EC2** `osc-nl-api`
- **NO liberes la Elastic IP `184.193.64.10`** — es la IP pública de la RDS, no
  de la EC2. Liberarla dejaría la base sin dirección.
- Borra el subdominio de DuckDNS si ya no se usa
- El proyecto de Vercel en plan Hobby no genera costo

## Antes de dar acceso a alguien más

- [x] `CORS_ORIGENES` apuntando al dominio real
- [x] HTTPS activo (Let's Encrypt, renovación automática)
- [x] Backups de RDS: 7 días + snapshot manual
- [x] `APP_SECRET` generado en el servidor, distinto al de desarrollo
- [x] Contraseña del tablero distinta a la de desarrollo
- [x] Repositorio privado y sin datos personales dentro
- [ ] RDS con `Publicly accessible = No` (opcional: el security group ya
      restringe el acceso a la EC2)

### Detalle que se pasa por alto

Certbot **copia el VirtualHost** a `osc-api-le-ssl.conf` para el puerto 443, y
lo crea con permisos `644` — legibles por cualquier usuario del servidor. Como
ese archivo hereda las credenciales de la base y el `APP_SECRET`, hay que
corregirlo cada vez que certbot lo regenere:

```bash
sudo chmod 600 /etc/httpd/conf.d/osc-api-le-ssl.conf
```

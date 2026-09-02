# Backend (API en PHP)

API REST en PHP que conecta el dashboard de React con la base de datos MySQL.
Se eligió PHP porque es el mismo lenguaje que corre en el servidor de
producción del socio formador (RHEL 9.7 + Apache + PHP 8.5.9), lo que facilita
la migración directa cuando el proyecto pase de esta demo a su infraestructura
real.

## Cómo correrlo localmente

```bash
cd backend
PHP_CLI_SERVER_WORKERS=6 php -S localhost:8000
```

(Requiere PHP: `brew install php` en Mac.)

**Usa `PHP_CLI_SERVER_WORKERS`.** El servidor embebido de PHP atiende una sola
petición a la vez, y cada consulta a RDS tarda ~0.5–1.2s porque la base está en
`us-east-1`. Cada vista del dashboard dispara 4–5 peticiones a la vez (y React
en StrictMode las duplica en desarrollo), así que sin workers la página tarda
más de 10 segundos en pintarse. Con 6 workers baja a ~1.2s.

Esto es solo para desarrollo local: en producción Apache ya maneja la
concurrencia por su cuenta.

Los endpoints quedan bajo `/endpoints/`, por ejemplo:
<http://localhost:8000/endpoints/kpis-operativos.php>

Las credenciales se leen automáticamente de `../database/.env` (ver
`config/env.php`); no hace falta duplicarlas. En el servidor real basta con
definir `DB_HOST`, `DB_USER`, `DB_PASSWORD` y `DB_NAME` como variables de
entorno de Apache y no se toca ningún archivo.

## Autenticación

Todos los endpoints exigen un token, salvo `login.php`. El flujo es:

1. `POST /endpoints/login.php` con `{"usuario": "...", "password": "..."}`
2. Devuelve un token firmado con HMAC (no se guarda en la base: se valida con
   la firma)
3. El frontend lo manda en `Authorization: Bearer <token>` en cada petición

**No se usó HTTP Basic Auth** porque el frontend es una SPA estática: cualquier
credencial dentro de su código la puede leer quien abra las herramientas de
desarrollo. Aquí la contraseña vive solo en el servidor, como hash bcrypt en
`AUTH_PASSWORD_HASH`.

Para desarrollo local se puede desactivar con `AUTH_HABILITADA=false`.

Ver `.env.example` para todas las variables, y `DEPLOY.md` en la raíz para el
despliegue completo.

## Estructura

| Archivo | Qué hace |
|---|---|
| `config/env.php` | Carga el `.env` (parseo en PHP, tolera contraseñas con caracteres especiales) |
| `config/database.php` | Conexión PDO a MySQL, sin emulación de prepared statements |
| `config/api.php` | Cabeceras JSON + CORS, preflight `OPTIONS`, respuestas y manejo de errores |
| `config/reglas.php` | **Los supuestos de negocio en SQL, centralizados** (ver abajo) |
| `config/auth.php` | Tokens firmados con HMAC, verificación de credenciales |
| `endpoints/*.php` | Un archivo por endpoint, todos GET y solo lectura |

## Endpoints

| Endpoint | Devuelve | Parámetros |
|---|---|---|
| `osc.php` | Padrón de OSC para la tabla de la Vista Operativa | `municipio`, `rubro`, `estatus`, `q`, `limite` (máx 500), `pagina` |
| `kpis-operativos.php` | Los 3 indicadores de alerta | — |
| `kpis-estrategicos.php` | Los 4 números grandes | — |
| `registros-por-mes.php` | Serie mensual de altas (rellena meses vacíos con 0) | `meses` (1–60, def. 12) |
| `distribucion-rubro.php` | Conteo de OSC por rubro | `limite` |
| `fuentes-financiamiento.php` | Promedio de `porcentaje` por `tipo_fuente` | — |
| `beneficiarios-por-edad.php` | Suma de hombres/mujeres por `rango_edad` | — |
| `densidad-municipio.php` | Conteo de OSC por municipio | `limite` |
| `filtros.php` | Valores para los desplegables del FilterBar | — |
| `login.php` | **POST.** Único endpoint público; devuelve el token | cuerpo JSON |
| `sesion.php` | Comprueba si el token sigue vigente | — |
| `kpis-apoyos.php` | Totales de inversión social 2023-2024 | — |
| `apoyos-por-tipo.php` | Apoyos por tipo, desglosados por año | — |
| `apoyos-por-poblacion.php` | Apoyos por población objetivo, por año | `limite` (1–50, def. 10) |
| `apoyos.php` | Historial de apoyos, filtrable | `osc`, `anio`, `tipo`, `sin_emparejar`, `limite`, `pagina` |

En cualquier filtro, el valor `Todos` equivale a "sin filtro" (es lo que manda
el FilterBar del frontend).

Respuestas de error: `{"error": "..."}` con código HTTP 405 (método no
permitido), 422 (parámetro inválido) o 500 (fallo de base de datos). El detalle
real del error de SQL va al log del servidor, nunca al cliente.

## Supuestos pendientes de confirmar con el socio formador

El modelo actual (migraciones 001–007) no tiene columnas directas para algunos
indicadores del tablero, así que hubo que derivarlos. Todos están en
`config/reglas.php` — si el socio formador aclara la definición correcta, se
cambia **solo ahí** y todos los endpoints quedan corregidos.

1. **Donataria vigente** — no existe la columna. Se deriva de
   `fecha_ultima_publicacion_dof` dentro de los últimos 12 meses.
2. **Estatus documental de una OSC** — `Documentacion` guarda el estatus por
   documento. Se agrega con la regla "el peor estatus manda"; sin documentos
   cargados cuenta como `Pendiente`.
3. **Fuente de financiamiento pública** — `tipo_fuente` es texto libre, no un
   catálogo; se clasifica por coincidencia de nombre (Gobierno / Federal /
   Estatal / Municipal / Público).
4. **Gobernanza formal** — se define como `tiene_organo_gobierno = 1`.
5. **OSC activa** — no existe columna de baja, así que toda OSC registrada
   cuenta como activa.
6. **Población objetivo de los apoyos** — el catálogo cambió entre 2023 y 2024
   y las dos versiones conviven en la misma columna (`"Niñas, niños y
   adolescentes"` en 2023 pasó a `"NNA"` en 2024). Se unifican solo los pares
   que son inequívocamente la misma población; `"Primera infancia"` se deja
   aparte a propósito porque es otra franja etaria.
7. **Etiqueta del tipo de apoyo** — se le quita el prefijo numérico del
   catálogo (`"1. Anual"` → `"Anual"`), pero ese número se sigue usando para
   ordenar.

### Endpoints sin datos todavía

`fuentes-financiamiento.php` y `beneficiarios-por-edad.php` funcionan pero
devuelven `[]`: sus tablas están vacías y ningún CSV entregado las alimenta.
Se conservan para cuando llegue esa información; el dashboard ya no los
consume.

## Seguridad

- Todos los valores de query string entran por marcadores de PDO; no se
  concatena nada en el SQL.
- `LIMIT`/`OFFSET` se enlazan como enteros y vienen acotados por rango.
- `PDO::ATTR_EMULATE_PREPARES => false`: las consultas se preparan de verdad
  en el servidor MySQL.
- El CORS se configura con `CORS_ORIGENES`. Vacío equivale a `*`, que solo
  debe usarse en desarrollo local: en producción deja que cualquier página
  consulte la API desde el navegador de alguien que ya inició sesión.
- Los tokens se comparan con `hash_equals` (tiempo constante) y las
  credenciales verifican usuario y contraseña sin cortocircuito, para no
  filtrar por tiempo de respuesta si el usuario existe.
- El preflight `OPTIONS` no exige token a propósito: el navegador nunca manda
  `Authorization` en el preflight.

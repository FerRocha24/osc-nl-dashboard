# OSC NL — Tablero Inteligente

Proyecto de transformación digital para el Registro Estatal de Organizaciones
de la Sociedad Civil (OSC) de Nuevo León — módulo del Tablero Inteligente
(dashboard interno).

## Estructura del proyecto

```
osc-nl-dashboard/
├── frontend/     React + Vite — el dashboard (Vista Operativa / Estratégica)
├── backend/      API en PHP — conecta el frontend con la base de datos
└── database/     Migraciones SQL + script para crear las tablas en MySQL
```

## Por qué esta estructura

- **frontend/**: React, para una interfaz interactiva y moderna
- **backend/**: PHP, porque es el mismo lenguaje del servidor de producción
  real (RHEL + Apache + PHP + MySQL 8.4) — facilita la migración futura
- **database/**: MySQL 8.4, igual que producción; hoy corre en AWS RDS
  como ambiente de desarrollo/demo, y se migra con `mysqldump` al servidor
  real cuando el proyecto esté listo

## Cómo levantar cada parte

Ve al README específico de cada carpeta:
- [`frontend/README.md`](frontend/README.md)
- [`backend/README.md`](backend/README.md)
- Migraciones: corre `database/run_migrations.sh` (ver instrucciones dentro)

## Estado del proyecto

- ✅ Frontend completo (Vista Operativa + Vista Estratégica, con datos de muestra)
- ✅ Base de datos MySQL 8.4 creada en AWS RDS
- ✅ Migraciones SQL de las 7 tablas del modelo de datos
- ⬜ Backend PHP (endpoints pendientes)
- ⬜ Conectar frontend a datos reales (actualmente usa `mockData.js`)
- ⬜ Importar datos reales de los CSV (organizaciones.csv, apoyos.csv) a la BD

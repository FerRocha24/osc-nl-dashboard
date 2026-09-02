# Tablero Inteligente — OSC NL

Dashboard interno del Registro Estatal de OSC de Nuevo León. Proyecto React
independiente del Portal Web público, según la topología definida.

## Estructura

```
src/
├── components/     Header, FilterBar, ExportButton, tarjetas, tabla, panel de gráficas
├── pages/          OperativaPage.jsx, EstrategicaPage.jsx
├── data/           mockData.js — datos de muestra (no hay conexión real a BD)
└── styles/         global.css — tokens de diseño (colores, tipografía)
```

## Cómo correrlo localmente

```bash
npm install
npm run dev
```

Abre el link que te muestre la terminal (normalmente `http://localhost:5173`).

## Rutas

- `/` — Vista Operativa
- `/estrategica` — Vista Estratégica

## Notas importantes

- **Los filtros y el botón "Exportar reporte" son solo visuales** (mockeados),
  tal como se definió para esta entrega — no ejecutan lógica real de filtrado
  ni de exportación a PDF/Excel.
- **Los datos son de muestra** (`src/data/mockData.js`), no vienen de una base
  de datos real. En producción, esta capa de datos se reemplazaría por
  llamadas a la API/base de datos MySQL definida en el modelo de datos.

## Desplegar en Vercel

1. Sube este proyecto a un repositorio de GitHub (nuevo, separado del portal web)
2. Conecta el repo en vercel.com — Vercel detecta Vite automáticamente, no
   requiere configuración adicional
3. Deploy

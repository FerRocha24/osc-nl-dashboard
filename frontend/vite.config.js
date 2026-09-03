import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo, las peticiones a /endpoints/... se reenvían al backend de
    // PHP. Así el navegador solo habla con el servidor de Vite: mismo origen,
    // cero CORS mientras se desarrolla, y no hace falta configurar
    // CORS_ORIGENES con localhost en el backend.
    //
    // En producción esto no aplica: el frontend está en Vercel y llama al
    // backend por su URL absoluta (VITE_API_URL).
    proxy: {
      '/endpoints': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})

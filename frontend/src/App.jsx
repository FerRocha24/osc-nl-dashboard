import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import { Cargando } from "./components/EstadoPanel";
import { obtenerToken, suscribirseASesion } from "./api/auth";
import "./styles/global.css";

// Las dos vistas se cargan bajo demanda. Entre las dos arrastran Recharts,
// que es la mitad del peso de la aplicación, y quien todavía no inicia sesión
// no necesita nada de eso: así la pantalla de acceso baja solo lo suyo.
const OperativaPage = lazy(() => import("./pages/OperativaPage"));
const EstrategicaPage = lazy(() => import("./pages/EstrategicaPage"));

export default function App() {
  // La sesión vive en sessionStorage; aquí solo se refleja para decidir qué
  // pintar. El backend es quien de verdad valida el token en cada petición:
  // esto es únicamente para no mostrar un tablero vacío a quien no entró.
  const [token, setToken] = useState(obtenerToken);

  useEffect(() => suscribirseASesion(setToken), []);

  if (!token) {
    return <LoginPage />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<Cargando alto="100vh" />}>
        <Routes>
          <Route path="/" element={<OperativaPage />} />
          <Route path="/estrategica" element={<EstrategicaPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

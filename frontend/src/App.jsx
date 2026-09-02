import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import OperativaPage from "./pages/OperativaPage";
import EstrategicaPage from "./pages/EstrategicaPage";
import LoginPage from "./components/LoginPage";
import { obtenerToken, suscribirseASesion } from "./api/auth";
import "./styles/global.css";

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
      <Routes>
        <Route path="/" element={<OperativaPage />} />
        <Route path="/estrategica" element={<EstrategicaPage />} />
      </Routes>
    </BrowserRouter>
  );
}

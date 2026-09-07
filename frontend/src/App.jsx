import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import LoginPage from "./components/LoginPage";
import CambiarPassword from "./components/CambiarPassword";
import { Cargando } from "./components/EstadoPanel";
import { obtenerSesion, obtenerToken, suscribirseASesion } from "./api/auth";
import "./styles/global.css";

// Las dos vistas se cargan bajo demanda. Entre las dos arrastran Recharts,
// que es la mitad del peso de la aplicación, y quien todavía no inicia sesión
// no necesita nada de eso: así la pantalla de acceso baja solo lo suyo.
const OperativaPage = lazy(() => import("./pages/OperativaPage"));
const EstrategicaPage = lazy(() => import("./pages/EstrategicaPage"));
const UsuariosPage = lazy(() => import("./pages/UsuariosPage"));

export default function App() {
  // La sesión vive en sessionStorage; aquí solo se refleja para decidir qué
  // pintar. El backend es quien de verdad valida el token en cada petición:
  // esto es únicamente para no mostrar un tablero vacío a quien no entró.
  //
  // Se usa un contador en vez de guardar el token en estado: al cambiar la
  // contraseña el token NO cambia, solo la bandera debeCambiarPassword, y
  // React descartaba el re-render por recibir el mismo valor de siempre.
  // Dejaba a la persona atrapada en la pantalla de cambio.
  const [, forzarRender] = useState(0);
  useEffect(() => suscribirseASesion(() => forzarRender((n) => n + 1)), []);

  const token = obtenerToken();

  // Se guarda para QUÉ token se preparó el montaje, en vez de un booleano que
  // habría que apagar con otro setState al cerrar sesión.
  const [tokenListo, setTokenListo] = useState(null);
  useEffect(() => {
    if (!token) return;
    // setTimeout y no requestAnimationFrame: rAF no se ejecuta en pestañas
    // ocultas, así que quien iniciara sesión y cambiara de pestaña se quedaría
    // viendo "Cargando…" hasta volver. Los temporizadores sí corren.
    const id = setTimeout(() => setTokenListo(token), 0);
    return () => clearTimeout(id);
  }, [token]);

  const listo = token !== null && tokenListo === token;

  if (!token) {
    return <LoginPage />;
  }

  // El tablero se monta un frame después de que desaparece el login.
  //
  // Montándolo en el mismo commit de React, el ResponsiveContainer de Recharts
  // mide el ancho antes de que el navegador aplique el layout: se queda en
  // ~80px y no se recupera, ni con un evento de resize. Se nota al entrar
  // directo a /estrategica desde el login. Un frame de espera basta para que
  // las medidas ya estén hechas cuando las gráficas se montan.
  if (!listo) {
    return <Cargando alto="100vh" />;
  }

  // Quien crea la cuenta define una contraseña provisional. Si no se obliga a
  // cambiarla, esa contraseña —que conoce otra persona— se queda para siempre.
  if (obtenerSesion()?.debeCambiarPassword) {
    return <CambiarPassword obligatorio />;
  }

  return (
    <BrowserRouter>
      <Suspense fallback={<Cargando alto="100vh" />}>
        <Routes>
          <Route path="/" element={<OperativaPage />} />
          <Route path="/estrategica" element={<EstrategicaPage />} />
          <Route path="/usuarios" element={<UsuariosPage />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

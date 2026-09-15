import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { Estructura } from "./componentes/Estructura.jsx";
import { usarSesion } from "./api/sesion.js";
import { seccionesDe, inicioDe } from "./lib/roles.js";
import { Inventario } from "./pantallas/inventario/index.jsx";
import { Caja } from "./pantallas/caja/index.jsx";
import { Tablero } from "./pantallas/tablero/index.jsx";
import { Usuarios } from "./pantallas/usuarios/index.jsx";
import { Cuenta } from "./pantallas/cuenta/index.jsx";
import { Instalar } from "./pantallas/instalar/index.jsx";
import { Ingresar } from "./pantallas/acceso/Ingresar.jsx";
import { PrimerAdministrador } from "./pantallas/acceso/PrimerAdministrador.jsx";
import { CambiarClaveObligatoria } from "./pantallas/acceso/CambiarClave.jsx";

const PANTALLAS = {
  "/inventario": <Inventario />,
  "/caja": <Caja />,
  "/tablero": <Tablero />,
  "/usuarios": <Usuarios />
};

export function App() {
  const { pathname } = useLocation();
  const { usuario, listo, necesitaConfiguracion } = usarSesion();

  // La página de instalación se comparte por QR: abre sin sesión.
  if (pathname === "/instalar") return <Instalar />;

  if (!listo) return <div className="min-h-dvh bg-fondo" aria-busy="true" />;
  if (!usuario) return necesitaConfiguracion ? <PrimerAdministrador /> : <Ingresar />;
  if (usuario.debeCambiarClave) return <CambiarClaveObligatoria />;

  // Solo existen las rutas del rol. Cualquier otra lleva al inicio de esa persona.
  return (
    <Estructura>
      <Routes>
        {seccionesDe(usuario.rol).map((s) => (
          <Route key={s.a} path={s.a} element={PANTALLAS[s.a]} />
        ))}
        <Route path="/cuenta" element={<Cuenta />} />
        <Route path="*" element={<Navigate to={inicioDe(usuario.rol)} replace />} />
      </Routes>
    </Estructura>
  );
}

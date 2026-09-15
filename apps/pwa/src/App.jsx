import { Navigate, Route, Routes } from "react-router-dom";
import { Estructura } from "./componentes/Estructura.jsx";
import { Inventario } from "./pantallas/inventario/index.jsx";
import { Caja } from "./pantallas/caja/index.jsx";
import { Tablero } from "./pantallas/tablero/index.jsx";

// Tres lugares, en el orden en que se vive un día de tienda:
// entra la mercancía, se vende, y se mira cómo fue.
export function App() {
  return (
    <Estructura>
      <Routes>
        <Route path="/inventario" element={<Inventario />} />
        <Route path="/caja" element={<Caja />} />
        <Route path="/tablero" element={<Tablero />} />
        <Route path="*" element={<Navigate to="/inventario" replace />} />
      </Routes>
    </Estructura>
  );
}

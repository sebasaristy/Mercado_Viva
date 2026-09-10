import { Routes, Route, Navigate } from "react-router-dom";
import { BarraSync } from "./componentes/BarraSync.jsx";
import { Bodega } from "./pantallas/bodega/index.jsx";
import { Conteo } from "./pantallas/conteo/index.jsx";
import { Picking } from "./pantallas/picking/index.jsx";

export function App() {
  return (
    <>
      <BarraSync />
      <Routes>
        <Route path="/" element={<Navigate to="/bodega" replace />} />
        <Route path="/bodega" element={<Bodega />} />
        <Route path="/conteo" element={<Conteo />} />
        <Route path="/picking" element={<Picking />} />
      </Routes>
    </>
  );
}

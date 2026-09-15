import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.jsx";
import { arrancarSesion } from "./api/sesion.js";
import { arrancarSync } from "./local/sync.js";
import { escucharInstalacion } from "./lib/instalacion.js";
import "./estilos.css";

// Antes de pintar: el aviso de "se puede instalar" llega una sola vez y temprano.
escucharInstalacion();
arrancarSesion();
arrancarSync();

createRoot(document.getElementById("raiz")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App.jsx";
import { arrancarSync } from "./local/sync.js";
import "./estilos.css";

arrancarSync();

createRoot(document.getElementById("raiz")).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>
);

import express from "express";

import { config } from "./plataforma/config.js";
import { manejadorDeErrores } from "./plataforma/errores.js";
import { requiereSesion } from "./plataforma/auth.js";
import { registrarPeticiones, imprimirEnTerminal } from "./plataforma/peticiones.js";
import { montarPanelDev } from "./dev/index.js";

import catalogo from "./modulos/catalogo/index.js";
import inventario from "./modulos/inventario/index.js";
import disponibilidad from "./modulos/disponibilidad/index.js";
import conteo from "./modulos/conteo/index.js";
import pedidos from "./modulos/pedidos/index.js";

export function crearApp() {
  const app = express();

  app.use(express.json({ limit: "1mb" }));
  app.use(registrarPeticiones);
  if (config.esDesarrollo) app.use(imprimirEnTerminal);

  app.get("/salud", (_req, res) => res.json({ ok: true, modo: config.entorno }));

  // Cada módulo expone sus rutas en su index. app.js no sabe qué hay adentro.
  app.use("/catalogo", requiereSesion, catalogo.rutas);
  app.use("/inventario", requiereSesion, inventario.rutas);
  app.use("/disponibilidad", requiereSesion, disponibilidad.rutas);
  app.use("/conteo", requiereSesion, conteo.rutas);
  app.use("/pedidos", requiereSesion, pedidos.rutas);

  // Solo en desarrollo. Sin sesión: es una herramienta local, no una API.
  montarPanelDev(app);

  app.use(manejadorDeErrores);
  return app;
}

import express from "express";

import { config } from "./plataforma/config.js";
import { manejadorDeErrores } from "./plataforma/errores.js";
import { requiereSesion, permitir, soloEscriben } from "./plataforma/auth.js";
import { registrarPeticiones, imprimirEnTerminal } from "./plataforma/peticiones.js";
import { montarPanelDev } from "./dev/index.js";

import identidad from "./modulos/identidad/index.js";
import catalogo from "./modulos/catalogo/index.js";
import inventario from "./modulos/inventario/index.js";
import disponibilidad from "./modulos/disponibilidad/index.js";
import conteo from "./modulos/conteo/index.js";
import pedidos from "./modulos/pedidos/index.js";
import ventas from "./modulos/ventas/index.js";
import tablero from "./modulos/tablero/index.js";

export function crearApp() {
  const app = express();

  app.disable("x-powered-by");
  // Detrás de nginx. La IP real y si la conexión fue https llegan en cabeceras,
  // y solo se les cree cuando las pone el proxy de esta misma máquina.
  app.set("trust proxy", "loopback");

  app.use((_req, res, siguiente) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY"
    });
    siguiente();
  });

  app.use(express.json({ limit: "200kb" }));
  app.use(registrarPeticiones);
  if (config.esDesarrollo) app.use(imprimirEnTerminal);

  app.get("/salud", (_req, res) => res.json({ ok: true, modo: config.entorno, datos: config.datos }));

  // Entrar, salir y administrar usuarios. Cada ruta de adentro decide si pide sesión.
  app.use("/auth", identidad.rutas);

  // Quién puede qué. Está aquí, junto, para que se lea de un vistazo:
  //   cajero         vende; lee el catálogo para escanear
  //   bodega         mueve inventario y crea productos
  //   administrador  todo, más el tablero y los usuarios
  const bodega = ["administrador", "bodega"];
  app.use("/catalogo", requiereSesion, soloEscriben(...bodega), catalogo.rutas);
  app.use("/inventario", requiereSesion, soloEscriben(...bodega), inventario.rutas);
  app.use("/disponibilidad", requiereSesion, permitir(...bodega), disponibilidad.rutas);
  app.use("/conteo", requiereSesion, permitir(...bodega), conteo.rutas);
  app.use("/pedidos", requiereSesion, permitir(...bodega), pedidos.rutas);
  app.use("/ventas", requiereSesion, permitir("administrador", "cajero"), ventas.rutas);
  app.use("/tablero", requiereSesion, permitir("administrador"), tablero.rutas);

  // Solo con herramientas de desarrollo encendidas. Sin sesión: es local, no una API.
  montarPanelDev(app);

  app.use(manejadorDeErrores);
  return app;
}

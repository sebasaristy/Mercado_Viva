// Panel de desarrollo. Se monta en /dev SOLO fuera de producción.
// Sirve para ver qué está pasando mientras se construye: si la base conecta,
// qué tablas hay, cómo van los tres números del inventario y qué peticiones llegaron.
import { Router } from "express";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { config } from "../plataforma/config.js";
import { ultimasPeticiones } from "../plataforma/peticiones.js";
import * as estado from "./estado.js";

const aqui = path.dirname(fileURLToPath(import.meta.url));

export function montarPanelDev(app) {
  if (!config.esDesarrollo) return null;

  const rutas = Router();

  rutas.get("/", async (_req, res) => {
    res.type("html").send(await readFile(path.join(aqui, "panel.html"), "utf8"));
  });

  rutas.get("/estado", async (_req, res) => {
    const [db, migraciones, tablas, inventario, movimientos] = await Promise.all([
      estado.estadoBaseDeDatos(),
      estado.migracionesAplicadas(),
      estado.tablasYConteos().catch((e) => ({ error: e.message })),
      estado.fotoDelInventario(),
      estado.ultimosMovimientos()
    ]);

    res.json({
      entorno: {
        modo: config.entorno,
        puerto: config.puerto,
        archivoEnv: config.archivoEnv,
        authDesactivada: config.authDesactivada,
        tenant: config.tenantPorDefecto,
        node: process.version,
        arribaHace: Math.round(process.uptime()) + "s"
      },
      db,
      migraciones,
      tablas,
      inventario,
      movimientos,
      rutas: estado.rutasMontadas(app),
      peticiones: ultimasPeticiones(40)
    });
  });

  app.use("/dev", rutas);
  return rutas;
}

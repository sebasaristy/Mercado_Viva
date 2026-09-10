import { Router } from "express";
import * as servicio from "./servicio.js";

export const rutas = Router();

rutas.post("/:id/confirmar", async (req, res, siguiente) => {
  try { res.json(await servicio.confirmar(req.usuario, req.params.id)); }
  catch (e) { siguiente(e); }
});

// Cuando el recolector no encuentra algo, es el mejor dato de inventario que hay:
// alguien acaba de mirar el estante.
rutas.post("/lineas/:lineaId/faltante", async (req, res, siguiente) => {
  try { res.json(await servicio.marcarFaltante(req.usuario, req.params.lineaId)); }
  catch (e) { siguiente(e); }
});

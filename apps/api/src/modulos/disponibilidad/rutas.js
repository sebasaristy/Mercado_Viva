import { Router } from "express";
import * as servicio from "./servicio.js";

export const rutas = Router();

rutas.get("/:productoId", async (req, res, siguiente) => {
  try {
    res.json(await servicio.consultarDisponible(req.usuario.tenantId, req.params.productoId));
  } catch (e) { siguiente(e); }
});

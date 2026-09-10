import { Router } from "express";
import * as servicio from "./servicio.js";

export const rutas = Router();

// Las rutas no deciden nada: leen la petición, llaman al servicio, responden.
rutas.get("/productos/codigo/:codigo", async (req, res, siguiente) => {
  try {
    res.json(await servicio.buscarPorCodigo(req.usuario.tenantId, req.params.codigo));
  } catch (e) { siguiente(e); }
});

rutas.get("/productos/:id", async (req, res, siguiente) => {
  try {
    res.json(await servicio.obtener(req.usuario.tenantId, req.params.id));
  } catch (e) { siguiente(e); }
});

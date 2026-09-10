import { Router } from "express";
import { requiereClaveIdempotente } from "../../plataforma/idempotencia.js";
import { MovimientoNuevo } from "./esquemas.js";
import * as servicio from "./servicio.js";

export const rutas = Router();

rutas.post("/movimientos", requiereClaveIdempotente, async (req, res, siguiente) => {
  try {
    const entrada = MovimientoNuevo.parse({ ...req.body, id: req.claveIdempotente });
    const { movimiento, yaExistia } = await servicio.registrarMovimiento(req.usuario, entrada);
    res.status(yaExistia ? 200 : 201).json(movimiento);
  } catch (e) { siguiente(e); }
});

rutas.get("/existencias/:productoId", async (req, res, siguiente) => {
  try {
    res.json(await servicio.existenciaDe(req.usuario.tenantId, req.params.productoId));
  } catch (e) { siguiente(e); }
});

rutas.get("/movimientos/:productoId", async (req, res, siguiente) => {
  try {
    res.json(await servicio.historialDe(req.usuario.tenantId, req.params.productoId));
  } catch (e) { siguiente(e); }
});

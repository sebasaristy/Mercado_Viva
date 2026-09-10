import { Router } from "express";
import { requiereClaveIdempotente } from "../../plataforma/idempotencia.js";
import * as servicio from "./servicio.js";

export const rutas = Router();

rutas.post("/sesiones", async (req, res, siguiente) => {
  try { res.status(201).json(await servicio.abrirSesion(req.usuario, req.body)); }
  catch (e) { siguiente(e); }
});

rutas.post("/sesiones/:id/zonas", async (req, res, siguiente) => {
  try { res.status(201).json(await servicio.asignarZona(req.usuario, req.params.id, req.body)); }
  catch (e) { siguiente(e); }
});

rutas.post("/lineas", requiereClaveIdempotente, async (req, res, siguiente) => {
  try {
    res.status(201).json(
      await servicio.registrarLinea(req.usuario, { ...req.body, id: req.claveIdempotente })
    );
  } catch (e) { siguiente(e); }
});

rutas.post("/sesiones/:id/cerrar", async (req, res, siguiente) => {
  try { res.json(await servicio.cerrarSesion(req.usuario, req.params.id)); }
  catch (e) { siguiente(e); }
});

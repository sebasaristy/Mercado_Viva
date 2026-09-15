import { Router } from "express";
import { requiereClaveIdempotente } from "../../plataforma/idempotencia.js";
import { ProductoNuevo, Busqueda, ParametroId } from "./esquemas.js";
import * as servicio from "./servicio.js";

export const rutas = Router();

// Las rutas no deciden nada: leen la petición, llaman al servicio, responden.

rutas.get("/productos", async (req, res, siguiente) => {
  try {
    const { q } = Busqueda.parse(req.query);
    res.json(await servicio.listar(req.usuario.tenantId, q));
  } catch (e) { siguiente(e); }
});

// Va antes de /productos/:id para que "codigo" no se tome como un id.
rutas.get("/productos/codigo/:codigo", async (req, res, siguiente) => {
  try {
    res.json(await servicio.buscarPorCodigo(req.usuario.tenantId, req.params.codigo));
  } catch (e) { siguiente(e); }
});

rutas.get("/productos/:id", async (req, res, siguiente) => {
  try {
    const { id } = ParametroId.parse(req.params);
    res.json(await servicio.obtener(req.usuario.tenantId, id));
  } catch (e) { siguiente(e); }
});

rutas.post("/productos", requiereClaveIdempotente, async (req, res, siguiente) => {
  try {
    const entrada = ProductoNuevo.parse({ ...req.body, id: req.claveIdempotente });
    const r = await servicio.crear(req.usuario, entrada);
    res.status(r.yaExistia ? 200 : 201).json(r);
  } catch (e) { siguiente(e); }
});

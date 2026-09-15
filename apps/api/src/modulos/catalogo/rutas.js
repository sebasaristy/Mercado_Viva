import { Router } from "express";
import { requiereClaveIdempotente } from "../../plataforma/idempotencia.js";
import { ProductoNuevo, ProductoRapido, CambiosProducto, Busqueda, ParametroId } from "./esquemas.js";
import * as servicio from "./servicio.js";

export const rutas = Router();

// Las rutas no deciden nada: leen la petición, llaman al servicio, responden.
// Quién puede usar cada una se decide en app.js.

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

// Bodega completa un producto registrado desde la caja (o corrige cualquiera).
rutas.patch("/productos/:id", async (req, res, siguiente) => {
  try {
    const { id } = ParametroId.parse(req.params);
    res.json(await servicio.completar(req.usuario.tenantId, id, CambiosProducto.parse(req.body)));
  } catch (e) { siguiente(e); }
});

// Registro rápido desde la caja. Router aparte porque lo puede usar la cajera,
// que no puede crear productos completos.
export const rutasRapidas = Router();

rutasRapidas.post("/", requiereClaveIdempotente, async (req, res, siguiente) => {
  try {
    const entrada = ProductoRapido.parse({ ...req.body, id: req.claveIdempotente });
    const r = await servicio.crearRapido(req.usuario, entrada);
    res.status(r.yaExistia ? 200 : 201).json(r);
  } catch (e) { siguiente(e); }
});

import { Router } from "express";
import { requiereClaveIdempotente } from "../../../plataforma/idempotencia.js";
import { ErrorDeNegocio, ErrorDeEntrada, ErrorNoEncontrado } from "../../../plataforma/errores.js";
import { ReglaViolada, NoEncontrado } from "../dominio/errores.js";
import { MovimientoNuevo, ParametroProducto, ConsultaHistorial } from "./esquemas.js";

// La capa HTTP no decide nada de negocio. Hace tres cosas:
// traduce la petición a lo que espera el caso de uso, lo llama, y traduce el
// resultado (o el error del dominio) a códigos HTTP.
//
// Recibe el módulo ya armado: no importa la fábrica ni el repositorio.
export function crearRutas(inventario) {
  const rutas = Router();

  // Traduce errores del dominio a errores de transporte.
  // El dominio no conoce el 409; este archivo sí.
  const traducir = (e) => {
    if (e instanceof ReglaViolada) return new ErrorDeNegocio(e.message, e.codigo, 409);
    if (e instanceof NoEncontrado) return new ErrorNoEncontrado(e.message);
    if (e?.name === "ZodError") {
      return new ErrorDeEntrada("Los datos enviados no tienen la forma esperada.", e.issues);
    }
    return e;
  };

  rutas.post("/movimientos", requiereClaveIdempotente, async (req, res, siguiente) => {
    try {
      const entrada = MovimientoNuevo.parse({ ...req.body, id: req.claveIdempotente });
      const r = await inventario.registrarMovimiento(req.usuario, entrada);

      // 200 si ya lo teníamos (la tablet reintentó), 201 si es nuevo.
      // Los dos son éxito: la cola de la PWA trata igual ambos.
      res.status(r.yaExistia ? 200 : 201).json(r);
    } catch (e) { siguiente(traducir(e)); }
  });

  rutas.get("/existencias/:productoId", async (req, res, siguiente) => {
    try {
      const { productoId } = ParametroProducto.parse(req.params);
      res.json(await inventario.consultarExistencia(req.usuario.tenantId, productoId));
    } catch (e) { siguiente(traducir(e)); }
  });

  rutas.get("/movimientos/:productoId", async (req, res, siguiente) => {
    try {
      const { productoId } = ParametroProducto.parse(req.params);
      const { limite } = ConsultaHistorial.parse(req.query);
      res.json(await inventario.verHistorial(req.usuario.tenantId, productoId, limite));
    } catch (e) { siguiente(traducir(e)); }
  });

  return rutas;
}

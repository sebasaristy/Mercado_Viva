import { Router } from "express";
import { requiereClaveIdempotente } from "../../../plataforma/idempotencia.js";
import { ErrorDeNegocio } from "../../../plataforma/errores.js";
import { ReglaViolada } from "../dominio/errores.js";
import { VentaNueva } from "./esquemas.js";

// Traduce la petición al caso de uso y los errores del dominio a HTTP.
export function crearRutas(ventas) {
  const rutas = Router();

  rutas.post("/", requiereClaveIdempotente, async (req, res, siguiente) => {
    try {
      const entrada = VentaNueva.parse({ ...req.body, id: req.claveIdempotente });
      const r = await ventas.registrarVenta(req.usuario, entrada);
      // 200 si la caja reintentó y ya estaba, 201 si es nueva. Las dos son éxito.
      res.status(r.yaExistia ? 200 : 201).json(r);
    } catch (e) {
      siguiente(e instanceof ReglaViolada
        ? new ErrorDeNegocio(e.message, e.codigo, 409, e.detalle)
        : e);
    }
  });

  return rutas;
}

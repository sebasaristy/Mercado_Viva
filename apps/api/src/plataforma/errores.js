import { log } from "./log.js";

export class ErrorDeNegocio extends Error {
  constructor(mensaje, codigo = "regla_de_negocio", estado = 409, detalle = null) {
    super(mensaje);
    this.codigo = codigo;
    this.estado = estado;
    this.detalle = detalle;
  }
}

export class ErrorDeEntrada extends ErrorDeNegocio {
  constructor(mensaje, detalle = null) {
    super(mensaje, "entrada_invalida", 400, detalle);
  }
}

export class ErrorNoAutorizado extends ErrorDeNegocio {
  constructor() { super("Sesión inválida o vencida.", "no_autorizado", 401); }
}

export class ErrorNoEncontrado extends ErrorDeNegocio {
  constructor(que) { super(`No existe: ${que}`, "no_encontrado", 404); }
}

export function manejadorDeErrores(err, req, res, _siguiente) {
  if (err instanceof ErrorDeNegocio) {
    return res.status(err.estado).json({
      error: err.codigo, mensaje: err.message, detalle: err.detalle
    });
  }
  log.error({ err, ruta: req.originalUrl }, "error no controlado");
  res.status(500).json({ error: "interno", mensaje: "Algo falló de nuestro lado." });
}

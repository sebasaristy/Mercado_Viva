import { log } from "./log.js";
import { config } from "./config.js";

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

export class ErrorProhibido extends ErrorDeNegocio {
  constructor(mensaje = "Tu usuario no tiene permiso para esto.", codigo = "prohibido") {
    super(mensaje, codigo, 403);
  }
}

export class ErrorNoEncontrado extends ErrorDeNegocio {
  constructor(que) { super(`No existe: ${que}`, "no_encontrado", 404); }
}

export function manejadorDeErrores(err, req, res, _siguiente) {
  if (err instanceof ErrorDeNegocio) {
    return res.status(err.estado).json({
      error: err.codigo, mensaje: err.message, detalle: err.detalle,
      ...(err.campo ? { campo: err.campo } : {})
    });
  }

  // Un dato con la forma equivocada es culpa de quien llama (400), no del
  // servidor (500). Se devuelve el primer problema, que es el que hay que arreglar.
  if (err?.name === "ZodError") {
    const primero = err.issues?.[0];
    return res.status(400).json({
      error: "entrada_invalida",
      mensaje: primero?.message ?? "Los datos enviados no tienen la forma esperada.",
      campo: primero?.path?.join(".") ?? null,
      detalle: err.issues
    });
  }

  log.error({ err: err?.message, ruta: req.originalUrl }, "error no controlado");
  res.status(500).json({
    error: "interno",
    mensaje: "Algo falló de nuestro lado.",
    // En desarrollo se muestra la causa: sin esto, depurar es adivinar.
    ...(config.herramientasDev ? { causa: err?.message } : {})
  });
}

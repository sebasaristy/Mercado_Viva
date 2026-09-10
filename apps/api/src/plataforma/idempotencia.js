import { ErrorDeEntrada } from "./errores.js";

// El id de la operación lo genera la tablet cuando crea el movimiento, no cuando lo envía.
// Aquí solo lo exigimos y validamos la forma; quien decide qué hacer si ya existe
// es cada repo, apoyado en el primary key de su tabla.
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function requiereClaveIdempotente(req, _res, siguiente) {
  const clave = req.get("Idempotency-Key") || req.body?.id;
  if (!clave || !UUID.test(clave)) {
    return siguiente(new ErrorDeEntrada(
      "Falta el encabezado Idempotency-Key con un UUID válido."
    ));
  }
  req.claveIdempotente = clave;
  siguiente();
}

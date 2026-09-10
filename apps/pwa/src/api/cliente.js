import { tokenActual } from "./sesion.js";

const BASE = "/api";

export async function enviar(ruta, cuerpo, claveIdempotente) {
  const token = await tokenActual();

  let respuesta;
  try {
    respuesta = await fetch(BASE + ruta, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": claveIdempotente,
        ...(token ? { authorization: "Bearer " + token } : {})
      },
      body: JSON.stringify(cuerpo)
    });
  } catch {
    // No respondió nadie: es falta de red, no un rechazo del servidor.
    // La operación se queda en la cola y se reintenta.
    const error = new Error("Sin conexión con el servidor.");
    error.esDeRed = true;
    throw error;
  }

  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => ({}));
    const error = new Error(detalle.mensaje ?? "Error " + respuesta.status);
    error.estado = respuesta.status;
    error.detalle = detalle.detalle;
    // Un 4xx no se reintenta: el servidor ya dijo que está mal y reintentar
    // solo llena la cola. Un 5xx sí, porque puede ser pasajero.
    error.esDeRed = respuesta.status >= 500;
    throw error;
  }

  return respuesta.json();
}

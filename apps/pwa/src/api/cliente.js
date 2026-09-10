import { supabase } from "./sesion.js";

const BASE = "/api";

export async function enviar(ruta, cuerpo, claveIdempotente) {
  const { data } = await supabase.auth.getSession();
  const token = data?.session?.access_token;

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
  } catch (e) {
    // No respondió nadie: es falta de red, no un rechazo del servidor.
    const error = new Error("Sin conexión con el servidor.");
    error.esDeRed = true;
    throw error;
  }

  if (!respuesta.ok) {
    const detalle = await respuesta.json().catch(() => ({}));
    const error = new Error(detalle.mensaje ?? "Error " + respuesta.status);
    error.estado = respuesta.status;
    error.detalle = detalle.detalle;
    // Un 4xx no se reintenta: el servidor ya dijo que está mal.
    error.esDeRed = respuesta.status >= 500;
    throw error;
  }
  return respuesta.json();
}

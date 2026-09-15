import { ErrorApi, errorDeRespuesta, errorSinRed } from "./errores.js";
import { tokenActual, renovar, marcarDebeCambiarClave, usarSesion } from "./sesion.js";

export { ErrorApi };

const BASE = "/api";

async function pedir(metodo, ruta, { cuerpo, clave } = {}, puedeRenovar = true) {
  const token = await tokenActual();

  let respuesta;
  try {
    respuesta = await fetch(BASE + ruta, {
      method: metodo,
      headers: {
        ...(cuerpo ? { "content-type": "application/json" } : {}),
        ...(clave ? { "Idempotency-Key": clave } : {}),
        ...(token ? { authorization: "Bearer " + token } : {})
      },
      body: cuerpo ? JSON.stringify(cuerpo) : undefined
    });
  } catch {
    throw errorSinRed();
  }

  const datos = await respuesta.json().catch(() => null);

  // El token venció entre que se pidió y que llegó (o el servidor reinició):
  // se renueva una vez y se repite. Si la renovación dice que no, sesion.js
  // olvida el perfil y la app vuelve a la pantalla de ingreso.
  if (respuesta.status === 401 && puedeRenovar && usarSesion.getState().usuario) {
    try {
      await renovar();
    } catch (e) {
      if (e.deRed) throw e;
      throw errorDeRespuesta(respuesta, datos);
    }
    return pedir(metodo, ruta, { cuerpo, clave }, false);
  }

  if (!respuesta.ok) {
    if (datos?.error === "debe_cambiar_clave") marcarDebeCambiarClave();
    throw errorDeRespuesta(respuesta, datos);
  }

  return datos;
}

export const obtenerJson = (ruta) => pedir("GET", ruta);
export const enviarJson = (ruta, cuerpo, clave) => pedir("POST", ruta, { cuerpo, clave });
export const cambiarJson = (ruta, cuerpo) => pedir("PATCH", ruta, { cuerpo });

import { tokenActual } from "./sesion.js";

const BASE = "/api";

// Un error de la API con lo necesario para decidir qué hacer:
// deRed = no respondió nadie (se puede guardar y reintentar)
// si no = el servidor respondió que no (se le muestra el mensaje a la persona).
export class ErrorApi extends Error {
  constructor(mensaje, { estado = null, codigo = null, detalle = null, campo = null, causa = null, deRed = false } = {}) {
    super(mensaje);
    this.name = "ErrorApi";
    Object.assign(this, { estado, codigo, detalle, campo, causa, deRed });
  }
}

async function pedir(metodo, ruta, { cuerpo, clave } = {}) {
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
    throw new ErrorApi("No hay conexión con el servidor.", { deRed: true });
  }

  const datos = await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    // Nuestra API siempre responde JSON. Si no hay cuerpo y es 5xx, respondió
    // el proxy de desarrollo porque la API no está corriendo: eso es "sin red".
    const sinApi = !datos && respuesta.status >= 500;
    throw new ErrorApi(
      sinApi
        ? "No hay conexión con el servidor."
        : datos?.mensaje ?? `El servidor respondió ${respuesta.status}.`,
      {
        estado: respuesta.status,
        codigo: datos?.error,
        detalle: datos?.detalle,
        campo: datos?.campo,
        causa: datos?.causa,
        deRed: sinApi
      }
    );
  }

  return datos;
}

export const obtenerJson = (ruta) => pedir("GET", ruta);
export const enviarJson = (ruta, cuerpo, clave) => pedir("POST", ruta, { cuerpo, clave });

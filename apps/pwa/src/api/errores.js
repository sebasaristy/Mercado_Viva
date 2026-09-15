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

// Convierte una respuesta que no fue bien en un ErrorApi.
export function errorDeRespuesta(respuesta, datos) {
  // Nuestra API siempre responde JSON. Si no hay cuerpo y es 5xx, respondió el
  // proxy (Vite o nginx) porque la API no está corriendo: eso es "sin red".
  const sinApi = !datos && respuesta.status >= 500;
  return new ErrorApi(
    sinApi ? "No hay conexión con el servidor." : datos?.mensaje ?? `El servidor respondió ${respuesta.status}.`,
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

export const errorSinRed = () => new ErrorApi("No hay conexión con el servidor.", { deRed: true });

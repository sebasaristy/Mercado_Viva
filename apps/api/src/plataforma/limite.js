import { ErrorDeNegocio } from "./errores.js";

// Límite de intentos por equipo, en memoria. Con un solo proceso alcanza; si
// algún día corren varios, esto pasa a la base o a Redis.
//
// Es la segunda capa: la primera es el bloqueo de la cuenta en la base, que
// frena a quien prueba contraseñas contra UNA cédula. Esta frena a quien prueba
// una contraseña contra MUCHAS cédulas desde el mismo lugar.
export function limitarIntentos({ ventanaMs, maximo, mensaje, clave = (req) => req.ip }) {
  const registro = new Map();

  const limpiar = setInterval(() => {
    const ahora = Date.now();
    for (const [k, tiempos] of registro) {
      if (tiempos.every((t) => ahora - t >= ventanaMs)) registro.delete(k);
    }
  }, ventanaMs);
  limpiar.unref();

  return (req, res, siguiente) => {
    const k = clave(req);
    const ahora = Date.now();
    const tiempos = (registro.get(k) ?? []).filter((t) => ahora - t < ventanaMs);

    if (tiempos.length >= maximo) {
      const segundos = Math.ceil((ventanaMs - (ahora - tiempos[0])) / 1000);
      res.set("Retry-After", String(segundos));
      return siguiente(new ErrorDeNegocio(mensaje, "demasiados_intentos", 429, { segundos }));
    }

    tiempos.push(ahora);
    registro.set(k, tiempos);
    siguiente();
  };
}

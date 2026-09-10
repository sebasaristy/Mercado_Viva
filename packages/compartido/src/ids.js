// UUIDv7: lleva el tiempo adelante, así que ordena por fecha de creación
// y no fragmenta los índices como el v4.
//
// Se genera CUANDO SE CREA la operación en la tablet, nunca al enviarla.
// Ese id viaja como Idempotency-Key y es el primary key en la base:
// por eso reintentar el envío no duplica nada.
export function nuevoId() {
  const ms = Date.now();
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);

  b[0] = (ms / 2 ** 40) & 0xff;
  b[1] = (ms / 2 ** 32) & 0xff;
  b[2] = (ms / 2 ** 24) & 0xff;
  b[3] = (ms / 2 ** 16) & 0xff;
  b[4] = (ms / 2 ** 8) & 0xff;
  b[5] = ms & 0xff;
  b[6] = (b[6] & 0x0f) | 0x70;   // versión 7
  b[8] = (b[8] & 0x3f) | 0x80;   // variante

  const h = [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
  return [h.slice(0, 8), h.slice(8, 12), h.slice(12, 16), h.slice(16, 20), h.slice(20)].join("-");
}

const RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const esUuid = (v) => typeof v === "string" && RE.test(v);

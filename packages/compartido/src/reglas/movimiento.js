export const TIPOS_MOVIMIENTO = {
  ENTRADA:  { signo:  1, offline: true,  etiqueta: "Entrada de proveedor" },
  SALIDA:   { signo: -1, offline: true,  etiqueta: "Salida / venta" },
  MERMA:    { signo: -1, offline: true,  etiqueta: "Merma" },
  TRASLADO: { signo:  1, offline: true,  etiqueta: "Traslado" },
  CONTEO:   { signo:  1, offline: false, etiqueta: "Conteo" },
  AJUSTE:   { signo:  1, offline: false, etiqueta: "Ajuste" }
};

// El signo es del tipo, no de quien llama. "MERMA 3" nunca puede sumar.
export function signoDe(tipo) {
  const t = TIPOS_MOVIMIENTO[tipo];
  if (!t) throw new Error("Tipo de movimiento desconocido: " + tipo);
  return t.signo;
}

// Los deltas son conmutativos, así que llegar tarde o en desorden desde la cola
// da el mismo resultado. Los valores absolutos (conteo, ajuste) no lo son:
// esos necesitan una sesión abierta en el servidor.
export const seguroSinRed = (tipo) => TIPOS_MOVIMIENTO[tipo]?.offline === true;

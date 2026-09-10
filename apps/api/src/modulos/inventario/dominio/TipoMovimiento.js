import { ReglaViolada } from "./errores.js";

// Abierto a extensión, cerrado a modificación: agregar un tipo nuevo es agregar
// una entrada aquí. Ningún caso de uso tiene un switch por tipo que haya que tocar.
export const TIPOS = Object.freeze({
  ENTRADA:  { signo:  1, seguroSinRed: true,  exigeMotivo: false, etiqueta: "Entrada de proveedor" },
  SALIDA:   { signo: -1, seguroSinRed: true,  exigeMotivo: false, etiqueta: "Salida" },
  MERMA:    { signo: -1, seguroSinRed: true,  exigeMotivo: true,  etiqueta: "Merma" },
  TRASLADO: { signo:  1, seguroSinRed: true,  exigeMotivo: false, etiqueta: "Traslado" },
  CONTEO:   { signo:  1, seguroSinRed: false, exigeMotivo: false, etiqueta: "Conteo" },
  AJUSTE:   { signo:  1, seguroSinRed: false, exigeMotivo: true,  etiqueta: "Ajuste" }
});

export const NOMBRES = Object.freeze(Object.keys(TIPOS));

export function definicionDe(tipo) {
  const d = TIPOS[tipo];
  if (!d) {
    throw new ReglaViolada(
      `Tipo de movimiento desconocido: ${tipo}. Los válidos son ${NOMBRES.join(", ")}.`,
      "tipo_desconocido"
    );
  }
  return d;
}

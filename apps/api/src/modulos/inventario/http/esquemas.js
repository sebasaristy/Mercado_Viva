import { z } from "zod";
import { NOMBRES } from "../dominio/TipoMovimiento.js";

// Aquí solo se valida la FORMA de lo que llega: que sea un uuid, que sea un número,
// que el tipo exista. Las reglas de negocio —el signo, los decimales, el motivo
// obligatorio— viven en el dominio, no aquí.
//
// La diferencia importa: si mañana esto se llama desde una cola en vez de HTTP,
// las reglas siguen aplicándose; esta validación no.
export const MovimientoNuevo = z.object({
  id: z.string().uuid(),                     // lo genera la tablet al crear el movimiento
  productoId: z.string().uuid(),
  ubicacionId: z.string().uuid().nullish(),
  tipo: z.enum(NOMBRES),
  cantidad: z.coerce.number(),
  motivo: z.string().max(200).nullish(),
  referencia: z.string().max(120).nullish(),
  creadoEn: z.coerce.date()
});

export const ParametroProducto = z.object({
  productoId: z.string().uuid()
});

export const ConsultaHistorial = z.object({
  limite: z.coerce.number().int().positive().max(500).default(100)
});

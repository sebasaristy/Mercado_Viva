import { z } from "zod";

export const TIPOS = ["ENTRADA", "SALIDA", "MERMA", "TRASLADO", "CONTEO", "AJUSTE"];

export const MovimientoNuevo = z.object({
  id: z.string().uuid(),                    // lo genera la tablet
  productoId: z.string().uuid(),
  ubicacionId: z.string().uuid().nullish(),
  tipo: z.enum(TIPOS),
  cantidad: z.coerce.number().positive(),   // siempre positiva: el signo lo pone el tipo
  motivo: z.string().max(200).nullish(),
  referencia: z.string().max(120).nullish(),
  creadoEn: z.coerce.date()                 // cuándo ocurrió según el dispositivo
});

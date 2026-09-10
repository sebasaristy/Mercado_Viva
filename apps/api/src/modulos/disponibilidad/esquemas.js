import { z } from "zod";

export const LineaAReservar = z.object({
  productoId: z.string().uuid(),
  cantidad: z.coerce.number().positive()
});

export const Reserva = z.object({
  pedidoId: z.string().uuid(),
  lineas: z.array(LineaAReservar).min(1)
});

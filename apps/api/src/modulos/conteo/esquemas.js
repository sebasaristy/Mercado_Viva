import { z } from "zod";

export const SesionNueva = z.object({ sede: z.string().min(1) });

export const ZonaNueva = z.object({
  ubicacionId: z.string().uuid(),
  usuarioId: z.string().uuid()
});

export const LineaContada = z.object({
  id: z.string().uuid(),
  zonaId: z.string().uuid(),
  productoId: z.string().uuid(),
  cantidadContada: z.coerce.number().nonnegative(),
  contadoEn: z.coerce.date()
});

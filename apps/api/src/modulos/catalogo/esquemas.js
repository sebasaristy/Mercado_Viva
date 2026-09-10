import { z } from "zod";

export const Producto = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1),
  categoria: z.string(),
  unidad: z.enum(["unidad", "kg"]),
  precio: z.coerce.number().nonnegative()
});

import { z } from "zod";

export const ReglaSustitucion = z.enum([
  "equivalente", "mismo_tamano", "no_sustituir", "llamarme"
]);

export const PedidoNuevo = z.object({
  clienteId: z.string().uuid(),
  sede: z.string().min(1),
  reglaSustitucion: ReglaSustitucion.default("equivalente"),
  lineas: z.array(z.object({
    productoId: z.string().uuid(),
    cantidad: z.coerce.number().positive()
  })).min(1)
});

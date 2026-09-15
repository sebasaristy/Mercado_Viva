import { z } from "zod";
import { METODOS_PAGO } from "../dominio/Venta.js";

// Solo la FORMA de lo que llega. Las reglas —precio, stock, decimales— viven en
// el dominio y en la base. Fíjate que no se recibe precio: lo pone la base.
export const VentaNueva = z.object({
  id: z.string().uuid(),
  metodoPago: z.enum([...METODOS_PAGO], {
    errorMap: () => ({ message: "Elige cómo pagó el cliente." })
  }),
  recibido: z.coerce.number().min(0).nullish(),
  lineas: z
    .array(z.object({
      productoId: z.string().uuid(),
      cantidad: z.coerce.number().positive("La cantidad tiene que ser mayor que cero.")
    }))
    .min(1, "La venta no tiene productos.")
});

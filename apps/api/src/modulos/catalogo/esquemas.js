import { z } from "zod";

// Solo la forma de lo que llega. Los mensajes son los que ve quien está
// creando el producto en la tablet, así que van en su idioma.
export const ProductoNuevo = z.object({
  id: z.string().uuid(),
  codigo: z.string().trim().max(32, "El código es demasiado largo.")
    .nullish()
    .transform((v) => v || null),
  // required_error cubre el caso en que el campo ni siquiera llega: sin esto
  // zod responde "Required", en inglés, a quien está parado en la bodega.
  nombre: z.string({ required_error: "Escribe el nombre del producto." }).trim()
    .min(2, "Escribe el nombre del producto.")
    .max(80, "El nombre es demasiado largo."),
  categoria: z.string().trim().min(1).max(40).default("General"),
  unidad: z.enum(["unidad", "kg"], {
    errorMap: () => ({ message: "Elige si se vende por unidad o por kilo." })
  }),
  precio: z.coerce
    .number({ invalid_type_error: "Escribe el precio de venta." })
    .positive("El precio de venta tiene que ser mayor que cero."),
  costo: z.coerce.number().min(0, "El costo no puede ser negativo.").default(0),
  stockMinimo: z.coerce.number().min(0, "El mínimo no puede ser negativo.").default(0),
  cantidadInicial: z.coerce.number().min(0, "La cantidad no puede ser negativa.").default(0)
});

export const Busqueda = z.object({
  q: z.string().trim().max(60).optional()
});

export const ParametroId = z.object({
  id: z.string().uuid("El id del producto no es válido.")
});

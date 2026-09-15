import { z } from "zod";

// Solo la forma de lo que llega. Los mensajes son los que ve quien está
// creando el producto en la tablet o en la caja, así que van en su idioma.

const codigo = z.string().trim().max(32, "El código es demasiado largo.")
  .nullish()
  .transform((v) => v || null);

// required_error cubre el caso en que el campo ni siquiera llega: sin esto
// zod responde "Required", en inglés, a quien está parado en la bodega.
const nombre = z.string({ required_error: "Escribe el nombre del producto." }).trim()
  .min(2, "Escribe el nombre del producto.")
  .max(80, "El nombre es demasiado largo.");

const unidad = z.enum(["unidad", "kg"], {
  errorMap: () => ({ message: "Elige si se vende por unidad o por kilo." })
});

const precio = z.coerce
  .number({ invalid_type_error: "Escribe el precio de venta." })
  .positive("El precio de venta tiene que ser mayor que cero.");

const costo = z.coerce.number().min(0, "El costo no puede ser negativo.");
const stockMinimo = z.coerce.number().min(0, "El mínimo no puede ser negativo.");
const categoria = z.string().trim().min(1, "Elige una categoría.").max(40);

export const ProductoNuevo = z.object({
  id: z.string().uuid(),
  codigo,
  nombre,
  categoria: categoria.default("General"),
  unidad,
  precio,
  costo: costo.default(0),
  stockMinimo: stockMinimo.default(0),
  cantidadInicial: z.coerce.number().min(0, "La cantidad no puede ser negativa.").default(0)
});

// Desde la caja: lo mínimo para poder cobrarlo ya.
export const ProductoRapido = z.object({
  id: z.string().uuid(),
  codigo,
  nombre,
  unidad: unidad.default("unidad"),
  precio
});

// Bodega completa un producto. Todo opcional: se manda lo que se cambió.
export const CambiosProducto = z.object({
  nombre: nombre.optional(),
  categoria: categoria.optional(),
  precio: precio.optional(),
  costo: costo.optional(),
  stockMinimo: stockMinimo.optional()
});

export const Busqueda = z.object({
  q: z.string().trim().max(60).optional()
});

export const ParametroId = z.object({
  id: z.string().uuid("El id del producto no es válido.")
});

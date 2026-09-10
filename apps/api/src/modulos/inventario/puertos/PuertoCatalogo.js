// Lo único que inventario necesita saber del catálogo.
//
// Se declara aquí, no dentro de catalogo/, a propósito: es inventario quien define
// qué forma tiene que tener lo que recibe. Si mañana el catálogo cambia por dentro,
// mientras siga cumpliendo esto, inventario no se entera.

/**
 * @typedef {object} PuertoCatalogo
 * @property {(tenantId: string, productoId: string) => Promise<{
 *   id: string, nombre: string, unidad: "unidad"|"kg"
 * }>} obtenerProducto
 */

export function verificarCatalogo(puerto) {
  if (typeof puerto?.obtenerProducto !== "function") {
    throw new Error("El puerto de catálogo no cumple el contrato: falta obtenerProducto");
  }
  return puerto;
}

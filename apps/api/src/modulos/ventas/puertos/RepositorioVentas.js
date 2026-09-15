// El contrato que necesita el módulo de ventas.
//
// Es un solo método a propósito: registrar la venta, descontar el inventario y
// congelar los precios van juntos o no van. Quién garantiza eso es el
// adaptador —en Supabase, la función registrar_venta—, no quien llama.

/**
 * @typedef {object} ResultadoVenta
 * @property {boolean} ok
 * @property {string}  [error]      código de la regla que falló, si ok es false
 * @property {boolean} [yaExistia]  true si la caja está reintentando
 * @property {object}  [venta]      la venta como quedó guardada, con sus líneas
 * @property {object[]} [alertas]   productos que quedaron bajos, agotados o en negativo
 */

/**
 * @typedef {object} RepositorioVentas
 * @property {(venta: object) => Promise<ResultadoVenta>} registrar
 */

export function verificarRepositorioVentas(repo) {
  if (typeof repo?.registrar !== "function") {
    throw new Error("El repositorio de ventas no cumple el contrato: falta registrar");
  }
  return repo;
}

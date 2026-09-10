import { Movimiento } from "../dominio/Movimiento.js";

// El caso de uso orquesta: pide el producto, deja que el dominio decida si el
// movimiento es válido, y lo guarda. No sabe SQL ni sabe qué es una petición HTTP.
//
// Recibe sus dependencias en vez de importarlas. Eso es lo que permite correr
// las pruebas contra el repositorio en memoria sin cambiar una línea de aquí.
export function crearRegistrarMovimiento({ repositorio, catalogo }) {
  /**
   * @param {{id: string, tenantId: string, rol?: string}} usuario
   * @param {object} entrada  ya validada en forma por la capa HTTP
   * @returns {Promise<{movimiento: object, yaExistia: boolean, existencia: number}>}
   */
  return async function registrarMovimiento(usuario, entrada) {
    const producto = await catalogo.obtenerProducto(usuario.tenantId, entrada.productoId);

    // Todas las reglas viven en el dominio. Si algo no cuadra, tira aquí,
    // antes de abrir la transacción.
    const movimiento = Movimiento.crear({
      id: entrada.id,
      tenantId: usuario.tenantId,
      usuarioId: usuario.id,
      producto,
      tipo: entrada.tipo,
      cantidad: entrada.cantidad,
      motivo: entrada.motivo,
      referencia: entrada.referencia,
      ubicacionId: entrada.ubicacionId,
      creadoEn: entrada.creadoEn
    });

    const plano = movimiento.aPlano();

    return repositorio.enTransaccion(async (tx) => {
      const yaExistia = await repositorio.guardarMovimiento(tx, plano);

      // Si el movimiento ya estaba, la tablet está reintentando porque no le llegó
      // la respuesta. No se aplica el delta dos veces: se devuelve lo que ya hay.
      if (!yaExistia) {
        await repositorio.aplicarDelta(tx, plano.tenantId, plano.productoId, plano.cantidad);
      }

      const { cantidad } = await repositorio.existencia(plano.tenantId, plano.productoId);

      return {
        movimiento: await repositorio.porId(plano.id),
        yaExistia,
        existencia: cantidad
      };
    });
  };
}

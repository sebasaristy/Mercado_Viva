import { Movimiento } from "../dominio/Movimiento.js";

// El caso de uso orquesta: pide el producto, deja que el dominio decida si el
// movimiento es válido, y lo manda a guardar. No sabe si detrás hay Supabase,
// Postgres directo o un Map en memoria.
//
// Recibe sus dependencias en vez de importarlas. Eso es lo que permite correr
// las pruebas contra el repositorio en memoria sin cambiar una línea de aquí:
// cuando la conexión pasó de Postgres directo a la REST de Supabase, este
// archivo no se tocó.
export function crearRegistrarMovimiento({ repositorio, catalogo }) {
  /**
   * @param {{id: string, tenantId: string}} usuario
   * @param {object} entrada  ya validada en forma por la capa HTTP
   */
  return async function registrarMovimiento(usuario, entrada) {
    const producto = await catalogo.obtenerProducto(usuario.tenantId, entrada.productoId);

    // Todas las reglas viven en el dominio. Si algo no cuadra, tira aquí,
    // antes de tocar nada de afuera.
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

    // Guardar el asiento y aplicar el delta van juntos o no van: eso lo garantiza
    // el adaptador, no este archivo. Si el movimiento ya estaba, la tablet está
    // reintentando porque no le llegó la respuesta, y el delta no se aplica de nuevo.
    return repositorio.registrarMovimiento(movimiento.aPlano());
  };
}

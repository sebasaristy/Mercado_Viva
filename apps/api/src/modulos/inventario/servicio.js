import catalogo from "../catalogo/index.js";
import { enTransaccion } from "../../plataforma/transaccion.js";
import { ErrorDeNegocio } from "../../plataforma/errores.js";
import { signoDe } from "@mv/compartido";
import * as repo from "./repo.js";

// Única puerta de escritura del libro. Todo lo que mueve stock termina aquí:
// la bodega, el conteo, el picking y (más adelante) las devoluciones.
export async function registrarMovimiento(usuario, entrada) {
  const producto = await catalogo.obtener(usuario.tenantId, entrada.productoId);

  if (producto.unidad === "unidad" && !Number.isInteger(entrada.cantidad)) {
    throw new ErrorDeNegocio(
      `${producto.nombre} se maneja por unidad: la cantidad no puede tener decimales.`
    );
  }

  // El signo lo pone el tipo, no quien llama. Así "MERMA 3" nunca suma por descuido.
  const delta = signoDe(entrada.tipo) * Math.abs(entrada.cantidad);

  return enTransaccion(async (tx) => {
    const yaExistia = await repo.insertarMovimiento(tx, {
      ...entrada, tenantId: usuario.tenantId, usuarioId: usuario.id, cantidad: delta
    });

    // Si el movimiento ya estaba, la tablet está reintentando: no se aplica dos veces.
    if (yaExistia) {
      return { movimiento: await repo.movimientoPorId(tx, entrada.id), yaExistia: true };
    }

    await repo.aplicarDelta(tx, usuario.tenantId, entrada.productoId, delta);
    return { movimiento: await repo.movimientoPorId(tx, entrada.id), yaExistia: false };
  });
}

export const existenciaDe = (tenantId, productoId) => repo.existencia(tenantId, productoId);
export const historialDe = (tenantId, productoId) => repo.historial(tenantId, productoId);

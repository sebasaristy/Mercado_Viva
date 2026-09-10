import { enTransaccion } from "../../plataforma/transaccion.js";
import { ErrorDeNegocio } from "../../plataforma/errores.js";
import * as repo from "./repo.js";

export const consultarDisponible = (tenantId, productoId) =>
  repo.disponible(tenantId, productoId);

// Aparta unidades para un pedido. Se bloquea la existencia primero: si dos pedidos
// llegan a la vez por la última unidad, uno espera y el otro se lleva el faltante.
export async function reservar(tenantId, pedidoId, lineas, minutosVigencia = 120) {
  return enTransaccion(async (tx) => {
    const faltantes = [];

    for (const linea of lineas) {
      await repo.bloquearExistencia(tx, tenantId, linea.productoId);
      const d = await repo.disponibleEnTx(tx, tenantId, linea.productoId);

      if (d.disponible < linea.cantidad) {
        faltantes.push({ ...linea, disponible: d.disponible });
        continue;
      }
      await repo.insertarReserva(tx, {
        tenantId, pedidoId, ...linea, minutosVigencia
      });
    }

    if (faltantes.length) {
      throw new ErrorDeNegocio(
        "No alcanza el disponible para algunas líneas.",
        "sin_disponible", 409, { faltantes }
      );
    }
    return { reservado: lineas.length };
  });
}

// Lo corre un job. Sin esto, un carrito abandonado bloquea producto para siempre.
export const liberarVencidas = () => repo.liberarVencidas();

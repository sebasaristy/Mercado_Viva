import catalogo from "../catalogo/index.js";
import disponibilidad from "../disponibilidad/index.js";
import * as repo from "./repo.js";

// Al confirmar se aparta el producto y se congela el precio en cada línea.
// Si mañana sube el precio, este pedido no cambia.
export async function confirmar(usuario, pedidoId) {
  const lineas = await repo.lineasDe(pedidoId);
  await disponibilidad.reservar(usuario.tenantId, pedidoId, lineas);
  await repo.congelarPrecios(pedidoId);
  await repo.cambiarEstado(pedidoId, "confirmado");
  await repo.registrarEvento(pedidoId, "CONFIRMADO", usuario.id);
  return repo.obtener(pedidoId);
}

// Pendiente: proponer el reemplazo según la regla que el cliente eligió al comprar.
// Los candidatos ya salen de catalogo.equivalentesDe().
export async function marcarFaltante(usuario, lineaId) {
  const linea = await repo.linea(lineaId);
  await repo.cambiarEstadoLinea(lineaId, "no_disponible");
  await repo.registrarEvento(linea.pedido_id, "FALTANTE", usuario.id, { lineaId });

  const candidatos = await catalogo.equivalentesDe(usuario.tenantId, linea.producto_id);
  return { lineaId, candidatos };
}

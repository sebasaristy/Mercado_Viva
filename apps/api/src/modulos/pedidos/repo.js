import { consultar } from "../../plataforma/db.js";

export async function obtener(pedidoId) {
  const { rows } = await consultar("select * from pedidos where id = $1", [pedidoId]);
  return rows[0] ?? null;
}

export async function lineasDe(pedidoId) {
  const { rows } = await consultar(
    "select id, producto_id as \"productoId\", cantidad from pedido_lineas where pedido_id = $1",
    [pedidoId]
  );
  return rows;
}

export async function linea(lineaId) {
  const { rows } = await consultar("select * from pedido_lineas where id = $1", [lineaId]);
  return rows[0] ?? null;
}

export const congelarPrecios = (pedidoId) =>
  consultar(
    `update pedido_lineas l
        set precio_unit = p.precio, costo_unit = p.costo
       from productos p
      where p.id = l.producto_id and l.pedido_id = $1`,
    [pedidoId]
  );

export const cambiarEstado = (pedidoId, estado) =>
  consultar("update pedidos set estado = $2 where id = $1", [pedidoId, estado]);

export const cambiarEstadoLinea = (lineaId, estado) =>
  consultar("update pedido_lineas set estado_linea = $2 where id = $1", [lineaId, estado]);

export const registrarEvento = (pedidoId, tipo, actorId, datos = {}) =>
  consultar(
    "insert into pedido_eventos (pedido_id, tipo, actor_id, datos) values ($1,$2,$3,$4)",
    [pedidoId, tipo, actorId, datos]
  );

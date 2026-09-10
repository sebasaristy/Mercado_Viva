import { consultar } from "../../plataforma/db.js";

export async function disponible(tenantId, productoId) {
  const { rows } = await consultar(
    "select * from v_disponible where tenant_id = $1 and producto_id = $2",
    [tenantId, productoId]
  );
  return rows[0] ?? { teorico: 0, reservado: 0, colchon: 0, disponible: 0 };
}

// Serializa a los concurrentes sobre el mismo producto.
export async function bloquearExistencia(tx, tenantId, productoId) {
  await tx.query(
    "select 1 from existencias where tenant_id = $1 and producto_id = $2 for update",
    [tenantId, productoId]
  );
}

export async function disponibleEnTx(tx, tenantId, productoId) {
  const { rows } = await tx.query(
    "select * from v_disponible where tenant_id = $1 and producto_id = $2",
    [tenantId, productoId]
  );
  return rows[0] ?? { teorico: 0, reservado: 0, colchon: 0, disponible: 0 };
}

export async function insertarReserva(tx, r) {
  await tx.query(
    `insert into reservas (tenant_id, producto_id, pedido_id, cantidad, expira_en)
     values ($1, $2, $3, $4, now() + ($5 || ' minutes')::interval)`,
    [r.tenantId, r.productoId, r.pedidoId, r.cantidad, r.minutosVigencia]
  );
}

export async function liberarVencidas() {
  const { rowCount } = await consultar(
    "update reservas set estado = 'liberada' where estado = 'activa' and expira_en <= now()"
  );
  return rowCount;
}

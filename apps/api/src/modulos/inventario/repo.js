import { consultar } from "../../plataforma/db.js";

// Devuelve true si el movimiento ya estaba (reintento de la tablet).
// El primary key es el UUIDv7 que generó el dispositivo: esa es la idempotencia.
export async function insertarMovimiento(tx, m) {
  const { rowCount } = await tx.query(
    `insert into movimientos
       (id, tenant_id, producto_id, ubicacion_id, tipo, cantidad,
        motivo, referencia, usuario_id, creado_en)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (id) do nothing`,
    [m.id, m.tenantId, m.productoId, m.ubicacionId ?? null, m.tipo, m.cantidad,
     m.motivo ?? null, m.referencia ?? null, m.usuarioId, m.creadoEn]
  );
  return rowCount === 0;
}

// Nunca "cantidad = X". Siempre suma, y con la fila bloqueada:
// es lo que evita que dos operaciones simultáneas se pisen.
export async function aplicarDelta(tx, tenantId, productoId, delta) {
  await tx.query(
    `insert into existencias (tenant_id, producto_id, cantidad)
     values ($1, $2, $3)
     on conflict (tenant_id, producto_id) do update
       set cantidad = existencias.cantidad + excluded.cantidad,
           actualizado_en = now()`,
    [tenantId, productoId, delta]
  );
}

export async function movimientoPorId(tx, id) {
  const { rows } = await tx.query("select * from movimientos where id = $1", [id]);
  return rows[0] ?? null;
}

export async function existencia(tenantId, productoId) {
  const { rows } = await consultar(
    "select * from existencias where tenant_id = $1 and producto_id = $2",
    [tenantId, productoId]
  );
  return rows[0] ?? { tenant_id: tenantId, producto_id: productoId, cantidad: 0 };
}

export async function historial(tenantId, productoId, limite = 100) {
  const { rows } = await consultar(
    `select * from movimientos
      where tenant_id = $1 and producto_id = $2
      order by creado_en desc limit $3`,
    [tenantId, productoId, limite]
  );
  return rows;
}

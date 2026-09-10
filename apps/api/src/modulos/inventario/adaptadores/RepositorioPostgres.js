import { pool, consultar } from "../../../plataforma/db.js";

// Implementación real del puerto. Aquí, y solo aquí, hay SQL.
// Si mañana esto se muda a otra base, se cambia este archivo y nada más:
// ni el dominio ni los casos de uso se enteran.
export function crearRepositorioPostgres() {
  return {
    async enTransaccion(fn) {
      const tx = await pool.connect();
      try {
        await tx.query("begin");
        const r = await fn(tx);
        await tx.query("commit");
        return r;
      } catch (e) {
        await tx.query("rollback");
        throw e;
      } finally {
        tx.release();
      }
    },

    // Devuelve true si ya existía. El primary key es el UUIDv7 que generó la tablet,
    // así que reintentar el envío no puede duplicar el movimiento.
    async guardarMovimiento(tx, m) {
      const { rowCount } = await tx.query(
        `insert into movimientos
           (id, tenant_id, producto_id, ubicacion_id, tipo, cantidad,
            motivo, referencia, usuario_id, creado_en)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         on conflict (id) do nothing`,
        [m.id, m.tenantId, m.productoId, m.ubicacionId, m.tipo, m.cantidad,
         m.motivo, m.referencia, m.usuarioId, m.creadoEn]
      );
      return rowCount === 0;
    },

    // Nunca "cantidad = X". Siempre suma, dentro de la transacción:
    // es lo que evita que dos operaciones simultáneas se pisen.
    async aplicarDelta(tx, tenantId, productoId, delta) {
      await tx.query(
        `insert into existencias (tenant_id, producto_id, cantidad)
         values ($1, $2, $3)
         on conflict (tenant_id, producto_id) do update
           set cantidad = existencias.cantidad + excluded.cantidad,
               actualizado_en = now()`,
        [tenantId, productoId, delta]
      );
    },

    async existencia(tenantId, productoId) {
      const { rows } = await consultar(
        "select cantidad from existencias where tenant_id = $1 and producto_id = $2",
        [tenantId, productoId]
      );
      return { cantidad: Number(rows[0]?.cantidad ?? 0) };
    },

    async historial(tenantId, productoId, limite = 100) {
      const { rows } = await consultar(
        `select id, tipo, cantidad, motivo, referencia, usuario_id, creado_en, registrado_en
           from movimientos
          where tenant_id = $1 and producto_id = $2
          order by creado_en desc
          limit $3`,
        [tenantId, productoId, limite]
      );
      return rows;
    },

    async porId(id) {
      const { rows } = await consultar("select * from movimientos where id = $1", [id]);
      return rows[0] ?? null;
    }
  };
}

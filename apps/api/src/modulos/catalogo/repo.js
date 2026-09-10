import { consultar } from "../../plataforma/db.js";

export async function porCodigo(tenantId, codigo) {
  const { rows } = await consultar(
    "select * from productos where tenant_id = $1 and codigo_barras = $2 and activo",
    [tenantId, codigo]
  );
  return rows[0] ?? null;
}

export async function porId(tenantId, id) {
  const { rows } = await consultar(
    "select * from productos where tenant_id = $1 and id = $2",
    [tenantId, id]
  );
  return rows[0] ?? null;
}

export async function equivalentes(tenantId, productoId) {
  const { rows } = await consultar(
    `select p.*, e.score
       from equivalencias e
       join productos p on p.id = e.equivalente_id
      where e.producto_id = $2 and p.tenant_id = $1 and p.activo
      order by e.score desc`,
    [tenantId, productoId]
  );
  return rows;
}

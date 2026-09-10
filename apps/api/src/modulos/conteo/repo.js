import { consultar } from "../../plataforma/db.js";

export async function crearSesion(tx, usuario, sede) {
  const { rows } = await tx.query(
    `insert into sesiones_conteo (tenant_id, sede, abierta_por)
     values ($1, $2, $3) returning *`,
    [usuario.tenantId, sede, usuario.id]
  );
  return rows[0];
}

export async function asignarZona(sesionId, ubicacionId, usuarioId) {
  const { rows } = await consultar(
    `insert into zonas_conteo (sesion_id, ubicacion_id, usuario_id)
     values ($1, $2, $3) returning *`,
    [sesionId, ubicacionId, usuarioId]
  );
  return rows[0];
}

export async function guardarLinea(_usuario, l) {
  const { rows } = await consultar(
    `insert into conteo_lineas
       (id, zona_id, producto_id, cantidad_contada, snapshot_teorico, contado_en)
     values ($1, $2, $3, $4,
       coalesce((select cantidad from existencias
                  where producto_id = $3 limit 1), 0), $5)
     on conflict (id) do nothing
     returning *`,
    [l.id, l.zonaId, l.productoId, l.cantidadContada, l.contadoEn]
  );
  return rows[0] ?? { id: l.id, repetido: true };
}

export async function lineasDeSesion(sesionId) {
  const { rows } = await consultar(
    `select cl.* from conteo_lineas cl
       join zonas_conteo z on z.id = cl.zona_id
      where z.sesion_id = $1`,
    [sesionId]
  );
  return rows;
}

// Lo que se movió del producto entre que se abrió la sesión y ahora.
export async function movidoDurante(tenantId, productoId, sesionId) {
  const { rows } = await consultar(
    `select coalesce(sum(m.cantidad), 0) as total
       from movimientos m, sesiones_conteo s
      where s.id = $3
        and m.tenant_id = $1
        and m.producto_id = $2
        and m.creado_en >= s.abierta_en
        and m.referencia is distinct from $3`,
    [tenantId, productoId, sesionId]
  );
  return rows[0].total;
}

export const cerrar = (sesionId) =>
  consultar(
    "update sesiones_conteo set estado = 'cerrada', cerrada_en = now() where id = $1",
    [sesionId]
  );

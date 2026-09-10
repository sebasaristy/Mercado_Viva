import { supabase, oTirar } from "../../plataforma/supabase.js";

export async function porCodigo(tenantId, codigo) {
  const filas = oTirar(
    await supabase.from("productos").select("*")
      .eq("tenant_id", tenantId).eq("codigo_barras", codigo).eq("activo", true).limit(1),
    "buscar producto por código"
  );
  return filas[0] ?? null;
}

export async function porId(tenantId, id) {
  const filas = oTirar(
    await supabase.from("productos").select("*")
      .eq("tenant_id", tenantId).eq("id", id).limit(1),
    "buscar producto por id"
  );
  return filas[0] ?? null;
}

export async function equivalentes(tenantId, productoId) {
  // Se trae la relación con el producto anidado: la REST resuelve el join
  // por la llave foránea, sin que haya que escribir SQL.
  const filas = oTirar(
    await supabase.from("equivalencias")
      .select("score, producto:productos!equivalencias_equivalente_id_fkey(*)")
      .eq("producto_id", productoId)
      .order("score", { ascending: false }),
    "buscar equivalencias"
  );

  return filas
    .filter((f) => f.producto?.tenant_id === tenantId && f.producto?.activo)
    .map((f) => ({ ...f.producto, score: f.score }));
}

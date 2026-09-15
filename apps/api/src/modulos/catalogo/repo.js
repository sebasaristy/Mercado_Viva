import { supabase, oTirar } from "../../plataforma/supabase.js";

// Lo que usa el flujo de la tienda va por funciones de la base: así el mismo
// código corre igual contra Supabase y contra el Postgres local.

export async function porCodigo(tenantId, codigo) {
  return oTirar(
    await supabase.rpc("producto_con_stock", { p_tenant_id: tenantId, p_codigo: codigo }),
    "buscar producto por código"
  );
}

export async function porId(tenantId, id) {
  return oTirar(
    await supabase.rpc("producto_con_stock", { p_tenant_id: tenantId, p_id: id }),
    "buscar producto"
  );
}

export async function listar(tenantId, busqueda) {
  return oTirar(
    await supabase.rpc("listar_productos", { p_tenant_id: tenantId, p_busqueda: busqueda || null }),
    "listar productos"
  );
}

export async function crear(p) {
  return oTirar(
    await supabase.rpc("crear_producto", {
      p_id: p.id,
      p_tenant_id: p.tenantId,
      p_usuario_id: p.usuarioId,
      p_nombre: p.nombre,
      p_categoria: p.categoria,
      p_unidad: p.unidad,
      p_precio: p.precio,
      p_costo: p.costo,
      p_stock_minimo: p.stockMinimo,
      p_codigo: p.codigo ?? null,
      p_cantidad_inicial: p.cantidadInicial,
      p_movimiento_id: p.movimientoId ?? null
    }),
    "crear producto"
  );
}

export async function crearRapido(p) {
  return oTirar(
    await supabase.rpc("crear_producto_rapido", {
      p_id: p.id,
      p_tenant_id: p.tenantId,
      p_usuario_id: p.usuarioId,
      p_nombre: p.nombre,
      p_precio: p.precio,
      p_unidad: p.unidad,
      p_codigo: p.codigo ?? null
    }),
    "registrar producto desde la caja"
  );
}

// Lo que llega undefined no se manda, y la función lo deja como estaba.
export async function completar(tenantId, id, c) {
  return oTirar(
    await supabase.rpc("completar_producto", {
      p_tenant_id: tenantId,
      p_id: id,
      p_nombre: c.nombre,
      p_categoria: c.categoria,
      p_precio: c.precio,
      p_costo: c.costo,
      p_stock_minimo: c.stockMinimo
    }),
    "completar producto"
  );
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

import { supabase, oTirar } from "../../plataforma/supabase.js";

export async function obtener(pedidoId) {
  const filas = oTirar(
    await supabase.from("pedidos").select("*").eq("id", pedidoId).limit(1),
    "leer pedido"
  );
  return filas[0] ?? null;
}

export async function lineasDe(pedidoId) {
  const filas = oTirar(
    await supabase.from("pedido_lineas")
      .select("id, producto_id, cantidad").eq("pedido_id", pedidoId),
    "leer líneas del pedido"
  );
  return filas.map((l) => ({ id: l.id, productoId: l.producto_id, cantidad: Number(l.cantidad) }));
}

export async function linea(lineaId) {
  const filas = oTirar(
    await supabase.from("pedido_lineas").select("*").eq("id", lineaId).limit(1),
    "leer línea"
  );
  return filas[0] ?? null;
}

// Congela el precio y el costo del momento en cada línea: si mañana sube el
// precio, este pedido no cambia.
export const congelarPrecios = (pedidoId) =>
  oTirar(
    supabase.rpc("congelar_precios_pedido", { p_pedido_id: pedidoId }),
    "congelar precios"
  );

export const cambiarEstado = (pedidoId, estado) =>
  oTirar(
    supabase.from("pedidos").update({ estado }).eq("id", pedidoId).select().single(),
    "cambiar estado del pedido"
  );

export const cambiarEstadoLinea = (lineaId, estado) =>
  oTirar(
    supabase.from("pedido_lineas").update({ estado_linea: estado })
      .eq("id", lineaId).select().single(),
    "cambiar estado de la línea"
  );

export const registrarEvento = (pedidoId, tipo, actorId, datos = {}) =>
  oTirar(
    supabase.from("pedido_eventos")
      .insert({ pedido_id: pedidoId, tipo, actor_id: actorId, datos }).select().single(),
    "registrar evento del pedido"
  );

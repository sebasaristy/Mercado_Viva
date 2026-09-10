import { supabase, oTirar } from "../../plataforma/supabase.js";

const VACIO = { teorico: 0, reservado: 0, colchon: 0, disponible: 0 };

export async function disponible(tenantId, productoId) {
  const datos = oTirar(
    await supabase.rpc("disponible_de", {
      p_tenant_id: tenantId,
      p_producto_id: productoId
    }),
    "consultar disponible"
  );
  if (!datos) return { ...VACIO };
  return {
    teorico: Number(datos.teorico),
    reservado: Number(datos.reservado),
    colchon: Number(datos.colchon),
    disponible: Number(datos.disponible)
  };
}

export async function insertarReserva(r) {
  const expira = new Date(Date.now() + (r.minutosVigencia ?? 120) * 60000).toISOString();
  return oTirar(
    await supabase.from("reservas").insert({
      tenant_id: r.tenantId,
      producto_id: r.productoId,
      pedido_id: r.pedidoId,
      cantidad: r.cantidad,
      expira_en: expira
    }).select().single(),
    "crear reserva"
  );
}

export async function liberarVencidas() {
  const filas = oTirar(
    await supabase.from("reservas")
      .update({ estado: "liberada" })
      .eq("estado", "activa")
      .lt("expira_en", new Date().toISOString())
      .select("id"),
    "liberar reservas vencidas"
  );
  return filas.length;
}

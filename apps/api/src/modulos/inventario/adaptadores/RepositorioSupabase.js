import { supabase, oTirar } from "../../../plataforma/supabase.js";

// Implementación real del puerto, contra la REST de Supabase con la service role.
// Aquí, y solo aquí, se sabe cómo se guardan las cosas.
//
// La escritura no se arma con dos llamadas seguidas a propósito: la REST no tiene
// transacciones de varias sentencias, así que insertar el asiento y aplicar el
// delta por separado podría dejar el libro y la proyección desalineados si la
// segunda llamada falla. Por eso se delega a la función registrar_movimiento,
// cuyo cuerpo sí corre como una sola transacción dentro de Postgres.
// Ver db/migraciones/006_funciones_inventario.sql.
export function crearRepositorioSupabase() {
  return {
    async registrarMovimiento(m) {
      const datos = oTirar(
        await supabase.rpc("registrar_movimiento", {
          p_id: m.id,
          p_tenant_id: m.tenantId,
          p_producto_id: m.productoId,
          p_tipo: m.tipo,
          p_cantidad: m.cantidad,
          p_usuario_id: m.usuarioId,
          p_creado_en: m.creadoEn instanceof Date ? m.creadoEn.toISOString() : m.creadoEn,
          p_ubicacion_id: m.ubicacionId ?? null,
          p_motivo: m.motivo ?? null,
          p_referencia: m.referencia ?? null
        }),
        "registrar_movimiento"
      );

      return {
        yaExistia: datos.yaExistia,
        existencia: Number(datos.existencia),
        movimiento: datos.movimiento
      };
    },

    async existencia(tenantId, productoId) {
      const filas = oTirar(
        await supabase
          .from("existencias")
          .select("cantidad")
          .eq("tenant_id", tenantId)
          .eq("producto_id", productoId)
          .limit(1),
        "leer existencia"
      );
      return { cantidad: Number(filas[0]?.cantidad ?? 0) };
    },

    async historial(tenantId, productoId, limite = 100) {
      return oTirar(
        await supabase
          .from("movimientos")
          .select("id, tipo, cantidad, motivo, referencia, usuario_id, creado_en, registrado_en")
          .eq("tenant_id", tenantId)
          .eq("producto_id", productoId)
          .order("creado_en", { ascending: false })
          .limit(limite),
        "leer historial"
      );
    },

    async porId(id) {
      const filas = oTirar(
        await supabase.from("movimientos").select("*").eq("id", id).limit(1),
        "leer movimiento"
      );
      return filas[0] ?? null;
    }
  };
}

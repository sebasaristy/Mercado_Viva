import { supabase, oTirar } from "../../../plataforma/supabase.js";

// La venta completa va en una sola llamada a la función registrar_venta, que
// escribe la venta, sus líneas, los movimientos y las existencias en una misma
// transacción. Ver db/migraciones/007_ventas_y_tablero.sql.
export function crearRepositorioSupabase() {
  return {
    async registrar(v) {
      return oTirar(
        await supabase.rpc("registrar_venta", {
          p_id: v.id,
          p_tenant_id: v.tenantId,
          p_usuario_id: v.usuarioId,
          p_metodo_pago: v.metodoPago,
          p_lineas: v.lineas,
          p_recibido: v.recibido
        }),
        "registrar venta"
      );
    }
  };
}

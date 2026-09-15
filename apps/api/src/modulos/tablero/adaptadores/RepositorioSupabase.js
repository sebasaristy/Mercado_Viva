import { supabase, oTirar } from "../../../plataforma/supabase.js";

// Todo el resumen sale de una sola función: agrega en la base en vez de traer
// miles de líneas de venta al servidor para sumarlas aquí.
export function crearRepositorioSupabase() {
  return {
    async resumen(tenantId, zona) {
      return oTirar(
        await supabase.rpc("resumen_tablero", { p_tenant_id: tenantId, p_zona: zona }),
        "resumen del tablero"
      );
    }
  };
}

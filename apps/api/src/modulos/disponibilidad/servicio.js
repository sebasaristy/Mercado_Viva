import { ErrorDeNegocio } from "../../plataforma/errores.js";
import { supabase, oTirar } from "../../plataforma/supabase.js";
import * as repo from "./repo.js";

export const consultarDisponible = (tenantId, productoId) =>
  repo.disponible(tenantId, productoId);

// Verificar y apartar tiene que ser un solo paso: si se parte en dos llamadas,
// dos pedidos simultáneos leen el mismo disponible y apartan los dos la última
// unidad. La función reservar_lineas bloquea las filas antes de mirar.
// Ver db/migraciones/006_funciones_inventario.sql.
export async function reservar(tenantId, pedidoId, lineas, minutosVigencia = 120) {
  const resultado = oTirar(
    await supabase.rpc("reservar_lineas", {
      p_tenant_id: tenantId,
      p_pedido_id: pedidoId,
      p_lineas: lineas.map((l) => ({ productoId: l.productoId, cantidad: l.cantidad })),
      p_minutos: minutosVigencia
    }),
    "reservar líneas"
  );

  if (!resultado.ok) {
    throw new ErrorDeNegocio(
      "No alcanza el disponible para algunas líneas.",
      "sin_disponible", 409, { faltantes: resultado.faltantes }
    );
  }
  return { reservado: resultado.reservadas };
}

// Lo corre un job. Sin esto, un carrito abandonado bloquea producto para siempre.
export const liberarVencidas = () => repo.liberarVencidas();

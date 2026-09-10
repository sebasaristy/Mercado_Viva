import { supabase, oTirar } from "../../plataforma/supabase.js";

export async function crearSesion(usuario, sede) {
  return oTirar(
    await supabase.from("sesiones_conteo")
      .insert({ tenant_id: usuario.tenantId, sede, abierta_por: usuario.id })
      .select().single(),
    "abrir sesión de conteo"
  );
}

// El unique (sesion_id, ubicacion_id) de la migración hace el trabajo:
// si la zona ya está tomada, la base rechaza con el código 23505.
export async function asignarZona(sesionId, ubicacionId, usuarioId) {
  return oTirar(
    await supabase.from("zonas_conteo")
      .insert({ sesion_id: sesionId, ubicacion_id: ubicacionId, usuario_id: usuarioId })
      .select().single(),
    "asignar zona"
  );
}

export async function guardarLinea(_usuario, l) {
  // El id lo genera la tablet: si ya está, es un reintento y se ignora.
  const filas = oTirar(
    await supabase.from("conteo_lineas")
      .upsert({
        id: l.id,
        zona_id: l.zonaId,
        producto_id: l.productoId,
        cantidad_contada: l.cantidadContada,
        snapshot_teorico: l.snapshotTeorico ?? 0,
        contado_en: l.contadoEn
      }, { onConflict: "id", ignoreDuplicates: true })
      .select(),
    "guardar línea de conteo"
  );
  return filas[0] ?? { id: l.id, repetido: true };
}

export async function lineasDeSesion(sesionId) {
  const filas = oTirar(
    await supabase.from("conteo_lineas")
      .select("*, zona:zonas_conteo!inner(sesion_id)")
      .eq("zona.sesion_id", sesionId),
    "leer líneas de la sesión"
  );
  return filas;
}

export const cerrar = (sesionId) =>
  oTirar(
    supabase.from("sesiones_conteo")
      .update({ estado: "cerrada", cerrada_en: new Date().toISOString() })
      .eq("id", sesionId).select().single(),
    "cerrar sesión"
  );

// Lo que se movió del producto desde que abrió la sesión.
// Va como función porque necesita comparar contra abierta_en de la sesión.
export async function movidoDurante(tenantId, productoId, sesionId) {
  const datos = oTirar(
    await supabase.rpc("movido_durante_conteo", {
      p_tenant_id: tenantId,
      p_producto_id: productoId,
      p_sesion_id: sesionId
    }),
    "calcular movimientos de la ventana"
  );
  return Number(datos ?? 0);
}

import { createClient } from "@supabase/supabase-js";
import { config } from "./config.js";

// El único cliente que habla con Supabase desde el servidor.
//
// Usa la SERVICE ROLE key, que se salta RLS por completo. Eso está bien aquí y
// solo aquí: este proceso es el que impone las reglas de negocio. Esa clave
// NUNCA puede llegar al navegador — la PWA usa la anon key y pasa por esta API.
export const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "public" },
  global: { headers: { "x-aplicacion": "mercado-viva-api" } }
});

// Cliente con la anon key, solo para verificar el token de un usuario.
// Respeta RLS, así que no sirve para escribir el inventario.
export const supabaseAnon = config.supabase.anonKey
  ? createClient(config.supabase.url, config.supabase.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null;

// Supabase devuelve { data, error } en vez de tirar. Esto lo normaliza para que
// el resto del código pueda usar try/catch como con cualquier otra cosa.
export function oTirar({ data, error }, contexto) {
  if (error) {
    const e = new Error(`${contexto}: ${error.message}`);
    e.codigoSupabase = error.code;
    e.detalle = error.details ?? error.hint ?? null;
    throw e;
  }
  return data;
}

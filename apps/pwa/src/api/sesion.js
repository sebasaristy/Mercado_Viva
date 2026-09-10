import { createClient } from "@supabase/supabase-js";

// Supabase se usa solo para el login y el token. Los datos van por la API.
//
// Sin credenciales configuradas la app NO se cae: sigue escribiendo en la base
// local y la cola espera, que es exactamente el mismo camino que cuando no hay
// señal en la bodega. Crear el cliente al importar el módulo hacía que la
// pantalla no cargara nunca, que es el peor error posible en una app que
// promete funcionar sin conexión.
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const hayAuth = Boolean(url && anon && !url.includes("["));

export const supabase = hayAuth
  ? createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export async function tokenActual() {
  if (!supabase) return null;
  try {
    const { data } = await supabase.auth.getSession();
    return data?.session?.access_token ?? null;
  } catch {
    return null;
  }
}

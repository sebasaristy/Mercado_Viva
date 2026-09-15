import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";

// El único cliente que habla con los datos desde el servidor.
//
// Con Supabase usa la SERVICE ROLE key, que se salta RLS por completo. Eso está
// bien aquí y solo aquí: este proceso es el que impone las reglas de negocio.
// Esa clave NUNCA puede llegar al navegador.
//
// En modo local (npm run dev:local) el mismo objeto habla con un Postgres dentro
// del proceso. Expone rpc() con la misma forma que Supabase, así que ni los
// módulos ni los casos de uso se enteran de la diferencia.
async function crearClienteLocal() {
  // Import dinámico: PGlite es de desarrollo y no existe en el despliegue.
  const { crearBaseLocal, crearRpcLocal } =
    await import(new URL("../../../../db/local.js", import.meta.url).href);

  const directorio = config.datosLocalEnMemoria
    ? null
    : fileURLToPath(new URL("../../../../.datos-local", import.meta.url));
  const db = await crearBaseLocal({ directorio, semillaDemo: true });

  return { rpc: crearRpcLocal(db), from: consultaNoDisponibleEnLocal, _db: db };
}

// En modo local solo existen las funciones. Una consulta directa a una tabla
// devuelve un error claro en vez de colgarse.
function consultaNoDisponibleEnLocal() {
  const resultado = {
    data: null,
    count: null,
    error: { message: "En modo local solo están disponibles las funciones (rpc).", code: "LOCAL" }
  };
  const encadenable = new Proxy(function () {}, {
    get: (_, prop) => (prop === "then" ? (resolver) => resolver(resultado) : () => encadenable),
    apply: () => encadenable
  });
  return encadenable;
}

export const supabase = config.datos === "local"
  ? await crearClienteLocal()
  : createClient(config.supabase.url, config.supabase.serviceRoleKey, {
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

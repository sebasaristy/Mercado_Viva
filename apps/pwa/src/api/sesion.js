import { createClient } from "@supabase/supabase-js";

// Supabase se usa solo para el login y el token. Los datos van por la API.
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

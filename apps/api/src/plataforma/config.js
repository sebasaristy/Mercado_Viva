// Un solo lugar donde se lee el entorno. El resto del código no toca process.env:
// así se sabe de un vistazo qué necesita la app para arrancar, y falla de una
// con un mensaje claro en vez de reventar a mitad de una petición.
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const raiz = path.resolve(process.cwd());

function cargarDotEnv() {
  for (const candidato of [".env", "../../.env"]) {
    const ruta = path.resolve(raiz, candidato);
    if (!existsSync(ruta)) continue;
    for (const linea of readFileSync(ruta, "utf8").split("\n")) {
      const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
    }
    return ruta;
  }
  return null;
}

const archivo = cargarDotEnv();

function exigir(nombre, ayuda) {
  const v = process.env[nombre];
  if (!v || v.includes("[")) {
    console.error(
      `\nFalta la variable ${nombre}.\n  ${ayuda}\n  Corre "npm run doctor" para ver todo lo que falta.\n`
    );
    process.exit(1);
  }
  return v;
}

export const config = {
  entorno: process.env.NODE_ENV ?? "development",
  esDesarrollo: (process.env.NODE_ENV ?? "development") !== "production",
  puerto: Number(process.env.PORT ?? 3000),
  archivoEnv: archivo,

  db: {
    url: exigir("DATABASE_URL", "Supabase → Settings → Database → Connection string"),
    // Supabase exige TLS pero con certificado que Node no valida por defecto.
    ssl: { rejectUnauthorized: false }
  },

  supabase: {
    url: process.env.SUPABASE_URL ?? "",
    anonKey: process.env.SUPABASE_ANON_KEY ?? ""
  },

  // Mientras haya una sola sede. Cuando entren más, sale del token del usuario.
  tenantPorDefecto: process.env.TENANT_ID ?? "00000000-0000-0000-0000-000000000001",

  // Sin login mientras se arma el resto. NUNCA en producción: config.js lo impide.
  authDesactivada: process.env.AUTH_DESACTIVADA === "true"
};

if (config.authDesactivada && !config.esDesarrollo) {
  console.error("\nAUTH_DESACTIVADA=true no se permite fuera de desarrollo.\n");
  process.exit(1);
}

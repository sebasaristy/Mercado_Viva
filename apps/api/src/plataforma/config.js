// Un solo lugar donde se lee el entorno. El resto del código no toca process.env:
// así se sabe de un vistazo qué necesita la app para arrancar, y falla de una
// con un mensaje claro en vez de reventar a mitad de una petición.
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";

const raiz = path.resolve(process.cwd());

function cargarDotEnv() {
  for (const candidato of [".env", "../../.env"]) {
    const ruta = path.resolve(raiz, candidato);
    if (!existsSync(ruta)) continue;
    // Se corta con \r?\n, no con \n: en Windows el .env viene con CRLF y el \r
    // que queda al final de cada línea hace fallar la expresión de abajo,
    // porque el punto no cruza retornos de carro. Sin esto no carga ni una variable.
    for (const linea of readFileSync(ruta, "utf8").split(/\r?\n/)) {
      const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
      if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
    }
    return ruta;
  }
  return null;
}

const archivo = cargarDotEnv();

const puesta = (v) => Boolean(v) && !v.includes("[");

function exigir(nombre, ayuda) {
  const v = process.env[nombre];
  if (!puesta(v)) {
    console.error(
      `\nFalta la variable ${nombre}.\n  ${ayuda}\n  Corre "npm run doctor" para ver todo lo que falta.\n` +
      `  O arranca sin Supabase con "npm run dev:local".\n`
    );
    process.exit(1);
  }
  return v;
}

// Acepta varios nombres para la misma clave. Es útil cuando el .env del equipo
// quedó con un nombre distinto al del ejemplo.
function exigirAlguna(nombres, ayuda) {
  for (const n of nombres) {
    if (puesta(process.env[n])) return process.env[n];
  }
  console.error(
    `\nFalta ${nombres[0]}.\n  ${ayuda}\n` +
    `  Alternativas aceptadas: ${nombres.slice(1).join(", ")}\n` +
    `  Corre "npm run doctor" para ver todo lo que falta.\n`
  );
  process.exit(1);
}

const entorno = process.env.NODE_ENV ?? "development";
const esDesarrollo = entorno !== "production";

// Modo local: la API corre contra un Postgres dentro del propio proceso
// (db/local.js) con datos de demostración. No necesita claves de Supabase.
// Sirve para que cualquiera del equipo pueda trabajar sin configurar nada.
const datos = process.env.DATOS === "local" || process.argv.includes("--local")
  ? "local"
  : "supabase";

if (datos === "local" && !esDesarrollo) {
  console.error("\nEl modo local es solo para desarrollo.\n");
  process.exit(1);
}

export const config = {
  entorno,
  esDesarrollo,
  puerto: Number(process.env.PORT ?? 3000),
  archivoEnv: archivo,
  datos,
  // Las pruebas levantan la API con la base local en memoria, sin tocar .datos-local/.
  datosLocalEnMemoria: process.env.DATOS_LOCAL_EN_MEMORIA === "1",

  // Todo entra por la REST de Supabase. No hay conexión directa a Postgres.
  supabase: datos === "supabase"
    ? {
        url: exigir("SUPABASE_URL", "Supabase → Settings → API → Project URL"),
        // Se salta RLS. Solo vive en el servidor, jamás en el navegador.
        // En Supabase se llama "service_role secret" (Settings → API).
        // NO es el "JWT secret", que es otra cosa y no sirve para esto.
        serviceRoleKey: exigirAlguna(
          ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET_ROLE", "SUPABASE_SERVICE_KEY"],
          "Supabase → Settings → API → service_role secret"
        ),
        // Respeta RLS. Es la que usa la PWA.
        anonKey: process.env.SUPABASE_ANON_KEY ?? ""
      }
    : { url: "", serviceRoleKey: "", anonKey: "" },

  // "Hoy" en el tablero es el día de la tienda, no el de UTC.
  zonaHoraria: process.env.ZONA_HORARIA ?? "America/Bogota",

  // Mientras haya una sola sede. Cuando entren más, sale del token del usuario.
  tenantPorDefecto: process.env.TENANT_ID ?? "00000000-0000-0000-0000-000000000001",

  sesion: {
    ...secretoDeSesion(),
    // El token de acceso vence rápido; la sesión del equipo dura semanas y se
    // renueva sola mientras se use.
    segundosAcceso: 600,
    diasSesion: Number(process.env.SESION_DIAS ?? 30),
    nombreCookie: "mv_sesion",
    // La ruta como la ve el NAVEGADOR. nginx y Vite le quitan /api antes de
    // llegar aquí, pero la cookie se guarda con la ruta de afuera.
    rutaCookie: process.env.COOKIE_RUTA ?? "/api/auth"
  },

  // Panel /dev y la causa de los errores 500 en la respuesta. Útiles en el
  // computador de cada uno; en un servidor abierto a internet se apagan con
  // HERRAMIENTAS_DEV=false aunque siga en modo desarrollo.
  herramientasDev: esDesarrollo && process.env.HERRAMIENTAS_DEV !== "false",

  // Salta el login para probar endpoints con curl. NUNCA en producción: se impide abajo.
  authDesactivada: process.env.AUTH_DESACTIVADA === "true"
};

// Con qué se firman los tokens de acceso. En desarrollo, si falta, se inventa
// uno al arrancar: los tokens de 10 minutos dejan de valer al reiniciar, pero
// la PWA los renueva sola con la cookie de sesión, así que nadie lo nota.
function secretoDeSesion() {
  const v = process.env.SESION_SECRETO;
  if (puesta(v) && v.length >= 32) return { secreto: v, secretoTemporal: false };
  if (!esDesarrollo) {
    console.error("\nFalta SESION_SECRETO (mínimo 32 caracteres).\n  Genera uno con: openssl rand -base64 48\n");
    process.exit(1);
  }
  return { secreto: randomBytes(48).toString("base64url"), secretoTemporal: true };
}

if (config.authDesactivada && !config.esDesarrollo) {
  console.error("\nAUTH_DESACTIVADA=true no se permite fuera de desarrollo.\n");
  process.exit(1);
}

// Revisa que el entorno esté listo antes de perder media hora buscando por qué no arranca.
//   npm run doctor
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const V = "\x1b[32m✔\x1b[0m";
const X = "\x1b[31m✖\x1b[0m";
const A = "\x1b[33m!\x1b[0m";
const tenue = (s) => `\x1b[2m${s}\x1b[0m`;

let fallas = 0;
const ok = (m, extra) => console.log(`  ${V} ${m}${extra ? " " + tenue(extra) : ""}`);
const mal = (m, comoArreglar) => {
  fallas++;
  console.log(`  ${X} ${m}`);
  if (comoArreglar) console.log(`      ${tenue("→ " + comoArreglar)}`);
};
const aviso = (m, nota) => console.log(`  ${A} ${m}${nota ? " " + tenue(nota) : ""}`);

const existe = (p) => access(path.join(raiz, p)).then(() => true, () => false);

console.log("\n\x1b[1mEntorno de desarrollo — Mercado Viva\x1b[0m\n");

/* ---------- 1. node y dependencias ---------- */
console.log("\x1b[1mBase\x1b[0m");

const mayor = Number(process.versions.node.split(".")[0]);
mayor >= 20
  ? ok(`Node ${process.versions.node}`)
  : mal(`Node ${process.versions.node} es muy viejo`, "instala Node 20 o superior");

(await existe("node_modules"))
  ? ok("Dependencias instaladas")
  : mal("Faltan las dependencias", "npm install");

(await existe("node_modules/@mv/compartido"))
  ? ok("Workspaces enlazados", "@mv/compartido resuelve")
  : mal("@mv/compartido no resuelve", "npm install desde la raíz, no desde apps/");

/* ---------- 2. variables de entorno ---------- */
console.log("\n\x1b[1mConfiguración\x1b[0m");

if (!(await existe(".env"))) {
  mal("No hay archivo .env", "cp .env.example .env y llénalo con los datos de Supabase");
} else {
  ok("Existe .env");
  const texto = await readFile(path.join(raiz, ".env"), "utf8");
  for (const linea of texto.split("\n")) {
    const m = linea.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const requeridas = {
  SUPABASE_URL: "Supabase → Settings → API → Project URL",
  TENANT_ID: "el uuid de la sede; sirve el de .env.example para el MVP"
};

const CLAVES_SERVICE = ["SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_JWT_SECRET_ROLE", "SUPABASE_SERVICE_KEY"];

for (const [nombre, donde] of Object.entries(requeridas)) {
  const v = process.env[nombre];
  if (!v || v.includes("[")) mal(`Falta ${nombre}`, donde);
  else ok(nombre, v.slice(0, 46));
}

const claveService = CLAVES_SERVICE.map((n) => process.env[n]).find((v) => v && !v.includes("["));
if (claveService) {
  const nombreUsado = CLAVES_SERVICE.find((n) => process.env[n] === claveService);
  ok("Clave service_role", nombreUsado === CLAVES_SERVICE[0]
    ? "(oculta)"
    : `(oculta) — está como ${nombreUsado}; el nombre del ejemplo es ${CLAVES_SERVICE[0]}`);
} else {
  mal("Falta la clave service_role",
    "Supabase → Settings → API → service_role secret (NO es el JWT secret)");
}

if (!process.env.SUPABASE_ANON_KEY) {
  aviso("SUPABASE_ANON_KEY vacía", "la API arranca, pero el login de la PWA no funcionará");
}

/* ---------- 3. Supabase ---------- */
console.log("\n\x1b[1mSupabase\x1b[0m");

const url = process.env.SUPABASE_URL;

if (!url || url.includes("[") || !claveService) {
  mal("No se puede probar la conexión", "llena SUPABASE_URL y la clave service_role primero");
} else {
  const sb = createClient(url, claveService, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Tabla -> módulo dueño, igual que en ARQUITECTURA.md.
  const TABLAS = [
    "productos", "equivalencias", "ubicaciones", "movimientos", "existencias",
    "reservas", "colchones", "sesiones_conteo", "zonas_conteo", "conteo_lineas",
    "pedidos", "pedido_lineas", "pedido_eventos"
  ];

  const resultados = await Promise.all(TABLAS.map(async (t) => {
    const { error, count } = await sb.from(t).select("*", { count: "exact", head: true });
    return { tabla: t, error, filas: count ?? 0 };
  }));

  const noAlcanzables = resultados.filter((r) => r.error && r.error.code === "42P01");
  const otrosErrores = resultados.filter((r) => r.error && r.error.code !== "42P01");

  if (otrosErrores.length) {
    const e = otrosErrores[0].error;
    mal(`No responde: ${e.message}`,
      /Invalid API key|JWT/i.test(e.message)
        ? "la clave no es la service_role; revisa Settings → API"
        : /fetch failed|ENOTFOUND/i.test(e.message)
        ? "revisa SUPABASE_URL; ¿el proyecto está activo?"
        : "revisa SUPABASE_URL y la clave");
  } else {
    ok("Responde la REST de Supabase");

    noAlcanzables.length === 0
      ? ok(`Las ${TABLAS.length} tablas están`)
      : mal(`Faltan ${noAlcanzables.length} tablas: ${noAlcanzables.map((r) => r.tabla).join(", ")}`,
          "corre las migraciones de db/migraciones en el editor SQL de Supabase");

    // La vista es la que da los tres números; sin ella no hay disponibilidad.
    const { error: eVista } = await sb.from("v_disponible")
      .select("*", { count: "exact", head: true });
    eVista
      ? mal("Falta la vista v_disponible", "corre db/migraciones/003_disponibilidad.sql")
      : ok("Vista v_disponible");

    // Las funciones son las que hacen las escrituras atómicas. Sin ellas no se
    // puede registrar nada, aunque las tablas estén.
    const FUNCIONES = ["registrar_movimiento", "disponible_de", "reservar_lineas",
                       "movido_durante_conteo", "congelar_precios_pedido"];
    const faltanFn = [];
    for (const fn of FUNCIONES) {
      const { error } = await sb.rpc(fn, {});
      // PGRST202 = la REST no encuentra la función. Cualquier otro error significa
      // que existe y se quejó por los argumentos, que es justo lo que esperamos.
      if (error?.code === "PGRST202") faltanFn.push(fn);
    }
    faltanFn.length === 0
      ? ok(`Las ${FUNCIONES.length} funciones RPC están`)
      : mal(`Faltan funciones: ${faltanFn.join(", ")}`,
          "corre db/migraciones/006_funciones_inventario.sql en el editor SQL de Supabase");

    const productos = resultados.find((r) => r.tabla === "productos");
    if (productos && !productos.error) {
      productos.filas > 0
        ? ok(`Hay ${productos.filas} productos`)
        : aviso("El catálogo está vacío",
            "corre db/semillas/productos_demo.sql en el editor SQL de Supabase");
    }
  }
}

/* ---------- resumen ---------- */
console.log();
if (fallas === 0) {
  console.log("\x1b[32m\x1b[1m  Todo listo.\x1b[0m  npm run dev\n");
} else {
  console.log(`\x1b[31m\x1b[1m  ${fallas} cosa${fallas > 1 ? "s" : ""} por arreglar.\x1b[0m\n`);
  process.exitCode = 1;
}

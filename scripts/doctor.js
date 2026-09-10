// Revisa que el entorno esté listo antes de perder media hora buscando por qué no arranca.
//   npm run doctor
import { readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

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
  DATABASE_URL: "cadena de conexión a Postgres (Supabase → Settings → Database)",
  SUPABASE_URL: "Supabase → Settings → API → Project URL",
  TENANT_ID: "el uuid de la sede; sirve el de .env.example para el MVP"
};

for (const [nombre, donde] of Object.entries(requeridas)) {
  const v = process.env[nombre];
  if (!v || v.includes("[")) mal(`Falta ${nombre}`, donde);
  else ok(nombre, nombre === "DATABASE_URL" ? "(oculta)" : v.slice(0, 42));
}

if (!process.env.SUPABASE_ANON_KEY) {
  aviso("SUPABASE_ANON_KEY vacía", "la API arranca, pero el login de la PWA no funcionará");
}

/* ---------- 3. base de datos ---------- */
console.log("\n\x1b[1mBase de datos\x1b[0m");

if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes("[")) {
  mal("No se puede probar la conexión", "llena DATABASE_URL primero");
} else {
  const db = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000
  });

  try {
    await db.connect();
    const { rows: [v] } = await db.query("select version()");
    ok("Conecta", v.version.split(",")[0]);

    // ¿Están las tablas que esperan los módulos?
    const esperadas = [
      ["productos", "catalogo"], ["equivalencias", "catalogo"],
      ["movimientos", "inventario"], ["existencias", "inventario"], ["ubicaciones", "inventario"],
      ["reservas", "disponibilidad"], ["colchones", "disponibilidad"],
      ["sesiones_conteo", "conteo"], ["zonas_conteo", "conteo"], ["conteo_lineas", "conteo"],
      ["pedidos", "pedidos"], ["pedido_lineas", "pedidos"], ["pedido_eventos", "pedidos"]
    ];
    const { rows } = await db.query(
      "select table_name from information_schema.tables where table_schema = 'public'"
    );
    const hay = new Set(rows.map((r) => r.table_name));

    const faltantes = esperadas.filter(([t]) => !hay.has(t));
    if (faltantes.length === 0) {
      ok(`Las ${esperadas.length} tablas están`);
    } else {
      mal(
        `Faltan ${faltantes.length} tablas: ${faltantes.map(([t]) => t).join(", ")}`,
        "npm run db:migrate"
      );
    }

    // La vista es lo que consulta disponibilidad; si no está, todo el ATP falla.
    const { rows: vistas } = await db.query(
      "select table_name from information_schema.views where table_name = 'v_disponible'"
    );
    vistas.length
      ? ok("Vista v_disponible")
      : mal("Falta la vista v_disponible", "revisa db/migraciones/003_disponibilidad.sql");

    if (hay.has("productos")) {
      const { rows: [c] } = await db.query("select count(*)::int as n from productos");
      c.n > 0
        ? ok(`Hay ${c.n} productos`)
        : aviso("El catálogo está vacío", "npm run db:seed para los datos de demo");
    }

    await db.end();
  } catch (e) {
    mal("No conecta: " + e.message,
      e.message.includes("password") ? "revisa la contraseña en DATABASE_URL"
      : e.message.includes("ENOTFOUND") ? "revisa el host; ¿el proyecto de Supabase está activo?"
      : "revisa DATABASE_URL");
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

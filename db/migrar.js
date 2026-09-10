// Migrador mínimo: corre en orden los .sql de db/migraciones y anota cuáles ya pasaron.
// Nunca se edita una migración aplicada; se crea la siguiente.
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const aqui = path.dirname(fileURLToPath(import.meta.url));
const semillas = process.argv.includes("--semillas");
const carpeta = path.join(aqui, semillas ? "semillas" : "migraciones");

const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
await db.connect();

await db.query(`
  create table if not exists _migraciones (
    archivo text primary key,
    aplicada_en timestamptz not null default now()
  )
`);

const archivos = (await readdir(carpeta)).filter((f) => f.endsWith(".sql")).sort();
const { rows } = await db.query("select archivo from _migraciones");
const aplicadas = new Set(rows.map((r) => r.archivo));

for (const archivo of archivos) {
  if (aplicadas.has(archivo)) continue;
  const sql = await readFile(path.join(carpeta, archivo), "utf8");
  try {
    await db.query("begin");
    await db.query(sql);
    await db.query("insert into _migraciones (archivo) values ($1)", [archivo]);
    await db.query("commit");
    process.stdout.write("  aplicada  " + archivo + "\n");
  } catch (e) {
    await db.query("rollback");
    process.stderr.write("  FALLÓ     " + archivo + "\n" + e.message + "\n");
    process.exit(1);
  }
}

await db.end();

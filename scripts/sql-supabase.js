// Junta en un solo archivo lo que hay que pegar en el editor SQL de Supabase.
//   npm run db:sql   ->   db/aplicar_en_supabase.sql
//
// Todo lo que va ahí es idempotente (create or replace, if not exists), así
// que pegarlo dos veces no rompe nada. Las mismas migraciones se prueban antes
// contra un Postgres real en db/__tests__.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const PARA_SUPABASE = ["006_funciones_inventario.sql", "007_ventas_y_tablero.sql", "008_identidad.sql", "009_registro_desde_caja.sql"];

const partes = await Promise.all(PARA_SUPABASE.map(async (archivo) => {
  const sql = await readFile(path.join(raiz, "db", "migraciones", archivo), "utf8");
  return `-- ============================================================\n-- ${archivo}\n-- ============================================================\n\n${sql}`;
}));

const salida = path.join(raiz, "db", "aplicar_en_supabase.sql");
await writeFile(salida,
  `-- Pegar COMPLETO en Supabase → SQL Editor → Run.\n` +
  `-- Se puede correr más de una vez sin problema.\n` +
  `-- Generado con "npm run db:sql" desde: ${PARA_SUPABASE.join(", ")}\n\n` +
  partes.join("\n\n")
);

process.stdout.write(`Listo: ${path.relative(raiz, salida)}\n`);

// Postgres de verdad corriendo dentro del proceso de Node (PGlite, Postgres
// compilado a WebAssembly). Se usa para dos cosas:
//
//  1. Las pruebas de db/__tests__: las funciones SQL se prueban contra un
//     Postgres real antes de pegarlas en Supabase, no "a ver si funcionan".
//  2. El modo local de la API (DATOS=local): cualquiera del equipo puede
//     trabajar sin claves de Supabase.
//
// Se aplican EXACTAMENTE las mismas migraciones que van a Supabase. Lo único
// que se prepara aparte es lo que Supabase ya trae y un Postgres pelado no.
import { PGlite } from "@electric-sql/pglite";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const aqui = path.dirname(fileURLToPath(import.meta.url));

const LO_QUE_SUPABASE_YA_TRAE = `
  do $$
  begin
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'service_role') then
      create role service_role nologin bypassrls;
    end if;
  end
  $$;
  create table if not exists _migraciones (
    archivo     text primary key,
    aplicada_en timestamptz not null default now()
  );
`;

export async function crearBaseLocal({ directorio = null, semillaDemo = false } = {}) {
  const db = directorio ? new PGlite(directorio) : new PGlite();
  await db.exec(LO_QUE_SUPABASE_YA_TRAE);

  const { rows } = await db.query("select archivo from _migraciones");
  const aplicadas = new Set(rows.map((r) => r.archivo));

  const carpeta = path.join(aqui, "migraciones");
  const archivos = (await readdir(carpeta)).filter((f) => f.endsWith(".sql")).sort();

  for (const archivo of archivos) {
    if (aplicadas.has(archivo)) continue;
    // gen_random_uuid() es nativo desde Postgres 13; la extensión no hace falta.
    const sql = (await readFile(path.join(carpeta, archivo), "utf8"))
      .replace(/create extension[^;]*;/gi, "");
    try {
      await db.transaction(async (tx) => {
        await tx.exec(sql);
        await tx.query("insert into _migraciones (archivo) values ($1)", [archivo]);
      });
    } catch (e) {
      throw new Error(`La migración ${archivo} falló: ${e.message}`);
    }
  }

  if (semillaDemo) {
    await db.exec(await readFile(path.join(aqui, "semillas", "demo_local.sql"), "utf8"));
  }

  return db;
}

const IDENTIFICADOR = /^[a-z_][a-z0-9_]*$/;

// Llama una función con la misma forma que supabase.rpc(): argumentos con
// nombre y respuesta { data, error }. Así el resto de la API no se entera de
// si del otro lado está Supabase o esta base local.
export function crearRpcLocal(db) {
  return async function rpc(nombre, argumentos = {}) {
    try {
      if (!IDENTIFICADOR.test(nombre)) throw new Error(`Nombre de función inválido: ${nombre}`);

      const claves = Object.keys(argumentos).filter((k) => argumentos[k] !== undefined);
      for (const k of claves) {
        if (!IDENTIFICADOR.test(k)) throw new Error(`Argumento inválido: ${k}`);
      }

      const valores = claves.map((k) => {
        const v = argumentos[k];
        if (v instanceof Date) return v.toISOString();
        return v !== null && typeof v === "object" ? JSON.stringify(v) : v;
      });

      const lista = claves.map((k, i) => `${k} => $${i + 1}`).join(", ");
      const { rows } = await db.query(`select ${nombre}(${lista}) as resultado`, valores);
      return { data: rows[0]?.resultado ?? null, error: null };
    } catch (e) {
      return { data: null, error: { message: e.message, code: e.code ?? null } };
    }
  };
}

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { verificarImplementacion } from "../puertos/RepositorioInventario.js";
import { crearRepositorioEnMemoria } from "../adaptadores/RepositorioEnMemoria.js";
import { nuevoId } from "@mv/compartido";

// Se usan ids fijos para que las corridas contra Supabase no ensucien el catálogo real.
const TENANT = process.env.TENANT_ID ?? "00000000-0000-0000-0000-000000000001";
const PRODUCTO = process.env.PRODUCTO_DE_PRUEBA ?? "00000000-0000-4000-8000-0000000000a1";
const USUARIO = "00000000-0000-4000-8000-0000000000b1";

// Pruebas de contrato: las mismas para toda implementación del puerto.
//
// Sirven para que el repositorio de memoria y el de Supabase sean de verdad
// intercambiables. Si una implementación pasa y la otra no, el diseño se rompió
// y las pruebas del caso de uso dejarían de significar algo.
//
// El de Supabase solo se prueba si hay credenciales; si no, se salta.

function pruebasDeContrato(nombre, crearRepo, opciones = {}) {
  describe(`contrato del repositorio — ${nombre}`, { skip: opciones.saltar }, () => {
    test("expone todos los métodos del puerto", async () => {
      const repo = await crearRepo();
      assert.doesNotThrow(() => verificarImplementacion(repo, nombre));
    });

    test("registrar dos veces el mismo id avisa que ya existía y no duplica", async () => {
      const repo = await crearRepo();
      const m = {
        id: "01a08c56-f6dd-75c1-b455-9a85929dafc1",
        tenantId: TENANT, productoId: PRODUCTO, ubicacionId: null,
        tipo: "ENTRADA", cantidad: 5, motivo: null, referencia: null,
        usuarioId: USUARIO, creadoEn: new Date()
      };

      const a = await repo.registrarMovimiento(m);
      const b = await repo.registrarMovimiento(m);

      assert.equal(a.yaExistia, false, "la primera vez es nuevo");
      assert.equal(b.yaExistia, true, "la segunda ya existía");
      assert.equal(b.existencia, a.existencia, "el delta no se aplicó dos veces");
    });

    test("los deltas suman, no reemplazan", async () => {
      const repo = await crearRepo();
      const base = {
        tenantId: TENANT, productoId: PRODUCTO, ubicacionId: null,
        motivo: null, referencia: null, usuarioId: USUARIO, creadoEn: new Date()
      };

      const uno = await repo.registrarMovimiento({
        ...base, id: nuevoId(), tipo: "ENTRADA", cantidad: 10
      });
      const dos = await repo.registrarMovimiento({
        ...base, id: nuevoId(), tipo: "SALIDA", cantidad: -4
      });

      assert.equal(dos.existencia - uno.existencia, -4);
    });

    test("un producto sin movimientos devuelve cero, no null", async () => {
      const repo = await crearRepo();
      const inventado = "00000000-0000-4000-8000-00000000ffff";
      assert.equal((await repo.existencia(TENANT, inventado)).cantidad, 0);
    });
  });
}

pruebasDeContrato("en memoria", async () => crearRepositorioEnMemoria());

// La misma batería contra Supabase. Se activa sola cuando hay credenciales,
// por ejemplo al correr las pruebas en local con el .env puesto.
const hayCredenciales = Boolean(
  process.env.SUPABASE_URL &&
  (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_JWT_SECRET_ROLE)
);

pruebasDeContrato(
  "supabase",
  async () => {
    const { crearRepositorioSupabase } = await import("../adaptadores/RepositorioSupabase.js");
    return crearRepositorioSupabase();
  },
  { saltar: hayCredenciales ? false : "sin credenciales de Supabase: se salta ese adaptador" }
);

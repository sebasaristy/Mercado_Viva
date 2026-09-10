import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { verificarImplementacion } from "../puertos/RepositorioInventario.js";
import { crearRepositorioEnMemoria } from "../adaptadores/RepositorioEnMemoria.js";

// Pruebas de contrato: las mismas para toda implementación del puerto.
//
// Sirven para que el repositorio de memoria y el de Postgres sean de verdad
// intercambiables. Si una implementación pasa y la otra no, el diseño se rompió
// y las pruebas del caso de uso dejarían de significar algo.
//
// El de Postgres solo se prueba si hay DATABASE_URL; si no, se salta.

function pruebasDeContrato(nombre, crearRepo, opciones = {}) {
  describe(`contrato del repositorio — ${nombre}`, { skip: opciones.saltar }, () => {
    test("expone todos los métodos del puerto", async () => {
      const repo = await crearRepo();
      assert.doesNotThrow(() => verificarImplementacion(repo, nombre));
    });

    test("guardar dos veces el mismo id avisa que ya existía", async () => {
      const repo = await crearRepo();
      const m = {
        id: "01a08c56-f6dd-75c1-b455-9a85929dafc1",
        tenantId: "t-1", productoId: "p-1", ubicacionId: null,
        tipo: "ENTRADA", cantidad: 5, motivo: null, referencia: null,
        usuarioId: "u-1", creadoEn: new Date()
      };

      await repo.enTransaccion(async (tx) => {
        assert.equal(await repo.guardarMovimiento(tx, m), false, "la primera vez es nuevo");
        assert.equal(await repo.guardarMovimiento(tx, m), true, "la segunda ya existía");
      });
    });

    test("aplicar deltas suma, no reemplaza", async () => {
      const repo = await crearRepo();
      await repo.enTransaccion(async (tx) => {
        await repo.aplicarDelta(tx, "t-1", "p-2", 10);
        await repo.aplicarDelta(tx, "t-1", "p-2", -4);
      });
      assert.equal((await repo.existencia("t-1", "p-2")).cantidad, 6);
    });

    test("un producto sin movimientos devuelve cero, no null", async () => {
      const repo = await crearRepo();
      assert.equal((await repo.existencia("t-1", "p-jamas-visto")).cantidad, 0);
    });

    test("si la transacción falla, no queda nada a medias", async () => {
      const repo = await crearRepo();
      await assert.rejects(
        repo.enTransaccion(async (tx) => {
          await repo.aplicarDelta(tx, "t-1", "p-3", 99);
          throw new Error("algo salió mal a mitad");
        })
      );
      assert.equal((await repo.existencia("t-1", "p-3")).cantidad, 0);
    });
  });
}

pruebasDeContrato("en memoria", async () => crearRepositorioEnMemoria());

// La misma batería contra Postgres. Se activa sola cuando hay DATABASE_URL,
// por ejemplo al correr las pruebas en local con el .env puesto.
const hayBase = Boolean(process.env.DATABASE_URL);

pruebasDeContrato(
  "postgres",
  async () => {
    const { crearRepositorioPostgres } = await import("../adaptadores/RepositorioPostgres.js");
    return crearRepositorioPostgres();
  },
  { saltar: hayBase ? false : "sin DATABASE_URL: se salta el adaptador de Postgres" }
);

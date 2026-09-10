import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { crearInventario } from "../fabrica.js";
import { crearRepositorioEnMemoria } from "../adaptadores/RepositorioEnMemoria.js";

// Estas pruebas corren el MISMO caso de uso que corre en producción.
// Lo único distinto es qué implementación del puerto recibe.
// Sin base de datos, sin servidor, sin red.

const TENANT = "t-1";
const usuario = { id: "u-1", tenantId: TENANT };

const catalogoFalso = {
  async obtenerProducto(_tenantId, productoId) {
    const productos = {
      "p-arroz": { id: "p-arroz", nombre: "Arroz Diana 500 g", unidad: "unidad" },
      "p-banano": { id: "p-banano", nombre: "Banano", unidad: "kg" }
    };
    const p = productos[productoId];
    if (!p) throw new Error("producto no existe");
    return p;
  }
};

const id = (n) => `01a08c56-f6dd-75c1-b455-9a85929daf${String(n).padStart(2, "0")}`;

const movimiento = (n, extra = {}) => ({
  id: id(n),
  productoId: "p-arroz",
  tipo: "ENTRADA",
  cantidad: 10,
  creadoEn: "2026-09-10T15:00:00Z",
  ...extra
});

describe("registrar movimiento", () => {
  let repo, inventario;

  beforeEach(() => {
    repo = crearRepositorioEnMemoria();
    inventario = crearInventario({ repositorio: repo, catalogo: catalogoFalso });
  });

  test("una entrada suma a la existencia", async () => {
    const r = await inventario.registrarMovimiento(usuario, movimiento(1));

    assert.equal(r.yaExistia, false);
    assert.equal(r.existencia, 10);
  });

  test("una merma resta", async () => {
    await inventario.registrarMovimiento(usuario, movimiento(1, { cantidad: 10 }));
    const r = await inventario.registrarMovimiento(
      usuario, movimiento(2, { tipo: "MERMA", cantidad: 3, motivo: "vencido" })
    );

    assert.equal(r.existencia, 7);
  });

  // Este es EL caso que hace posible el trabajo sin conexión.
  test("reintentar el mismo movimiento no lo aplica dos veces", async () => {
    const mismo = movimiento(1, { cantidad: 10 });

    const primera = await inventario.registrarMovimiento(usuario, mismo);
    const segunda = await inventario.registrarMovimiento(usuario, mismo);
    const tercera = await inventario.registrarMovimiento(usuario, mismo);

    assert.equal(primera.yaExistia, false);
    assert.equal(segunda.yaExistia, true);
    assert.equal(tercera.yaExistia, true);

    assert.equal(tercera.existencia, 10, "la existencia no puede haber subido a 30");
    assert.equal(repo._totalMovimientos(), 1, "solo puede haber un movimiento en el libro");
  });

  test("el orden en que llegan los deltas no cambia el resultado", async () => {
    // La cola de la PWA puede vaciarse en desorden. Los deltas son conmutativos,
    // así que el saldo final tiene que ser el mismo.
    const operaciones = [
      movimiento(1, { tipo: "ENTRADA", cantidad: 20 }),
      movimiento(2, { tipo: "SALIDA", cantidad: 5 }),
      movimiento(3, { tipo: "MERMA", cantidad: 3, motivo: "roto" })
    ];

    for (const op of operaciones) await inventario.registrarMovimiento(usuario, op);
    const enOrden = (await inventario.consultarExistencia(TENANT, "p-arroz")).cantidad;

    const repo2 = crearRepositorioEnMemoria();
    const inv2 = crearInventario({ repositorio: repo2, catalogo: catalogoFalso });
    for (const op of [...operaciones].reverse()) await inv2.registrarMovimiento(usuario, op);
    const alReves = (await inv2.consultarExistencia(TENANT, "p-arroz")).cantidad;

    assert.equal(enOrden, 12);
    assert.equal(alReves, enOrden);
  });

  test("si el movimiento viola una regla, no queda nada guardado", async () => {
    await assert.rejects(
      inventario.registrarMovimiento(usuario, movimiento(1, { cantidad: 2.5 })),
      (e) => e.codigo === "decimales_en_unidad"
    );

    assert.equal(repo._totalMovimientos(), 0);
    assert.equal((await inventario.consultarExistencia(TENANT, "p-arroz")).cantidad, 0);
  });

  test("el banano sí acepta 2.5 kg", async () => {
    const r = await inventario.registrarMovimiento(
      usuario, movimiento(1, { productoId: "p-banano", cantidad: 2.5 })
    );
    assert.equal(r.existencia, 2.5);
  });
});

describe("ver historial", () => {
  test("cada movimiento trae el saldo que dejó", async () => {
    const repo = crearRepositorioEnMemoria();
    const inventario = crearInventario({ repositorio: repo, catalogo: catalogoFalso });

    await inventario.registrarMovimiento(usuario, {
      ...movimiento(1, { cantidad: 20 }), creadoEn: "2026-09-10T10:00:00Z"
    });
    await inventario.registrarMovimiento(usuario, {
      ...movimiento(2, { tipo: "SALIDA", cantidad: 5 }), creadoEn: "2026-09-10T11:00:00Z"
    });

    const { existenciaActual, movimientos } = await inventario.verHistorial(TENANT, "p-arroz");

    assert.equal(existenciaActual, 15);
    // Viene del más reciente al más viejo.
    assert.equal(movimientos[0].saldoDespues, 15);
    assert.equal(movimientos[1].saldoDespues, 20);
  });
});

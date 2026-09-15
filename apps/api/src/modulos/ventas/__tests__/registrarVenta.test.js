import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Venta } from "../dominio/Venta.js";
import { crearVentas } from "../fabrica.js";
import { crearRepositorioEnMemoria } from "../adaptadores/RepositorioEnMemoria.js";

const ARROZ = "30000000-0000-4000-8000-000000000001";
const BANANO = "30000000-0000-4000-8000-000000000002";
const usuario = { id: "u-1", tenantId: "t-1" };

const catalogo = {
  [ARROZ]: { nombre: "Arroz Diana", unidad: "unidad", precio: 3200, stockMinimo: 5 },
  [BANANO]: { nombre: "Banano", unidad: "kg", precio: 3800, stockMinimo: 2 }
};

const nueva = (repo) => crearVentas({ repositorio: repo });

describe("Venta (dominio)", () => {
  test("junta el mismo producto escaneado dos veces en una línea", () => {
    const v = Venta.crear({
      id: "v1", metodoPago: "tarjeta",
      lineas: [{ productoId: ARROZ, cantidad: 1 }, { productoId: ARROZ, cantidad: 2 }]
    });
    assert.deepEqual(v.lineas, [{ productoId: ARROZ, cantidad: 3 }]);
  });

  test("no deja errores de coma flotante en los kilos", () => {
    const v = Venta.crear({
      id: "v1", metodoPago: "tarjeta",
      lineas: [{ productoId: BANANO, cantidad: 0.1 }, { productoId: BANANO, cantidad: 0.2 }]
    });
    assert.equal(v.lineas[0].cantidad, 0.3);
  });

  test("con tarjeta ignora lo recibido: no hay cambio que dar", () => {
    const v = Venta.crear({
      id: "v1", metodoPago: "tarjeta", recibido: 50000,
      lineas: [{ productoId: ARROZ, cantidad: 1 }]
    });
    assert.equal(v.recibido, null);
  });

  test("una venta vacía se rechaza con un mensaje que entiende la cajera", () => {
    assert.throws(
      () => Venta.crear({ id: "v1", metodoPago: "efectivo", lineas: [] }),
      (e) => e.codigo === "venta_vacia" && e.message === "La venta no tiene productos."
    );
  });
});

describe("registrar venta", () => {
  test("descuenta stock y avisa cuando algo queda bajo", async () => {
    const repo = crearRepositorioEnMemoria({ productos: catalogo, existencias: { [ARROZ]: 7 } });
    const r = await nueva(repo).registrarVenta(usuario, {
      id: "v1", metodoPago: "efectivo", recibido: 10000,
      lineas: [{ productoId: ARROZ, cantidad: 3 }]
    });

    assert.equal(r.venta.total, 9600);
    assert.equal(r.venta.cambio, 400);
    assert.equal(repo._existencia(ARROZ), 4);
    assert.equal(r.alertas.length, 1, "4 quedó por debajo del mínimo de 5");
  });

  test("reintentar la misma venta no descuenta dos veces", async () => {
    const repo = crearRepositorioEnMemoria({ productos: catalogo, existencias: { [ARROZ]: 10 } });
    const ventas = nueva(repo);
    const entrada = { id: "v1", metodoPago: "tarjeta", lineas: [{ productoId: ARROZ, cantidad: 2 }] };

    await ventas.registrarVenta(usuario, entrada);
    const otra = await ventas.registrarVenta(usuario, entrada);

    assert.equal(otra.yaExistia, true);
    assert.equal(repo._existencia(ARROZ), 8);
  });

  test("traduce el error de la base a algo que se pueda arreglar en la caja", async () => {
    const repo = crearRepositorioEnMemoria({ productos: catalogo });
    await assert.rejects(
      nueva(repo).registrarVenta(usuario, {
        id: "v1", metodoPago: "efectivo", recibido: 1000,
        lineas: [{ productoId: ARROZ, cantidad: 1 }]
      }),
      (e) => e.codigo === "recibido_insuficiente" && e.message.includes("3.200")
    );
    assert.equal(repo._totalVentas(), 0);
  });
});

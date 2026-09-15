import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { crearBaseLocal, crearRpcLocal } from "../local.js";

// Las funciones SQL se prueban contra un Postgres real (PGlite) con las mismas
// migraciones que van a Supabase. Si esto pasa, lo que se pega allá funciona.

const T = "00000000-0000-0000-0000-000000000001";
const U = "00000000-0000-0000-0000-0000000000de";
let n = 0;
const id = () => `20000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

async function rpcOk(rpc, nombre, args) {
  const { data, error } = await rpc(nombre, args);
  if (error) throw new Error(`${nombre}: ${error.message}`);
  return data;
}

describe("funciones SQL", () => {
  let db, rpc;

  before(async () => {
    db = await crearBaseLocal();
    rpc = crearRpcLocal(db);
  });
  after(() => db.close());

  const crear = (extra = {}) => rpcOk(rpc, "crear_producto", {
    p_id: id(), p_tenant_id: T, p_usuario_id: U,
    p_nombre: "Arroz", p_categoria: "Abarrotes", p_unidad: "unidad",
    p_precio: 3200, p_costo: 2400, p_stock_minimo: 5,
    p_codigo: String(7700000000000 + n), p_cantidad_inicial: 20,
    ...extra
  });

  describe("crear_producto", () => {
    test("crea el producto con su stock inicial", async () => {
      const r = await crear({ p_nombre: "Arroz Diana" });
      assert.equal(r.ok, true);
      assert.equal(r.producto.nombre, "Arroz Diana");
      assert.equal(r.producto.existencia, 20);
      assert.equal(r.producto.estado, "ok");
    });

    test("un código repetido no crea otro producto y devuelve el que ya existe", async () => {
      const primero = await crear({ p_codigo: "7709990000001", p_nombre: "Primero" });
      const segundo = await crear({ p_codigo: "7709990000001", p_nombre: "Segundo" });
      assert.equal(segundo.ok, false);
      assert.equal(segundo.error, "codigo_duplicado");
      assert.equal(segundo.producto.id, primero.producto.id);
    });

    test("reintentar con el mismo id no duplica el stock", async () => {
      const args = {
        p_id: id(), p_tenant_id: T, p_usuario_id: U, p_nombre: "Café", p_categoria: "Abarrotes",
        p_unidad: "unidad", p_precio: 9800, p_costo: 7600, p_codigo: "7709990000002",
        p_cantidad_inicial: 10
      };
      await rpcOk(rpc, "crear_producto", args);
      const otra = await rpcOk(rpc, "crear_producto", args);
      assert.equal(otra.yaExistia, true);
      assert.equal(otra.producto.existencia, 10);
    });

    test("rechaza decimales en un producto por unidad", async () => {
      const r = await crear({ p_cantidad_inicial: 2.5 });
      assert.equal(r.ok, false);
      assert.equal(r.error, "cantidad_invalida");
    });
  });

  describe("registrar_venta", () => {
    test("descuenta stock, toma el precio de la base y calcula totales y cambio", async () => {
      const arroz = (await crear({ p_precio: 3200, p_costo: 2400, p_cantidad_inicial: 30 })).producto;
      const banano = (await crear({
        p_unidad: "kg", p_precio: 3800, p_costo: 2400, p_cantidad_inicial: 10, p_nombre: "Banano"
      })).producto;

      const r = await rpcOk(rpc, "registrar_venta", {
        p_id: id(), p_tenant_id: T, p_usuario_id: U, p_metodo_pago: "efectivo",
        p_recibido: 20000,
        p_lineas: [
          { productoId: arroz.id, cantidad: 3, precioUnit: 1 },   // el precio del cliente se ignora
          { productoId: banano.id, cantidad: 0.85 }
        ]
      });

      assert.equal(r.ok, true);
      // 3 × 3200 + round(0.85 × 3800) = 9600 + 3230
      assert.equal(r.venta.total, 12830);
      assert.equal(r.venta.cambio, 20000 - 12830);
      assert.equal(r.venta.lineas.length, 2);
      assert.equal(r.venta.lineas[0].precioUnit, 3200);

      const a = await rpcOk(rpc, "producto_con_stock", { p_tenant_id: T, p_id: arroz.id });
      const b = await rpcOk(rpc, "producto_con_stock", { p_tenant_id: T, p_id: banano.id });
      assert.equal(a.existencia, 27);
      assert.equal(b.existencia, 9.15);
    });

    test("reintentar la misma venta no descuenta dos veces", async () => {
      const p = (await crear({ p_cantidad_inicial: 10 })).producto;
      const args = {
        p_id: id(), p_tenant_id: T, p_usuario_id: U, p_metodo_pago: "tarjeta",
        p_lineas: [{ productoId: p.id, cantidad: 2 }]
      };
      await rpcOk(rpc, "registrar_venta", args);
      const otra = await rpcOk(rpc, "registrar_venta", args);
      assert.equal(otra.yaExistia, true);
      const ahora = await rpcOk(rpc, "producto_con_stock", { p_tenant_id: T, p_id: p.id });
      assert.equal(ahora.existencia, 8);
    });

    test("si un producto no existe no se escribe nada de la venta", async () => {
      const p = (await crear({ p_cantidad_inicial: 10 })).producto;
      const ventaId = id();
      const r = await rpcOk(rpc, "registrar_venta", {
        p_id: ventaId, p_tenant_id: T, p_usuario_id: U, p_metodo_pago: "efectivo",
        p_lineas: [
          { productoId: p.id, cantidad: 1 },
          { productoId: "20000000-0000-4000-8000-999999999999", cantidad: 1 }
        ]
      });
      assert.equal(r.ok, false);
      assert.equal(r.error, "producto_no_existe");

      const ahora = await rpcOk(rpc, "producto_con_stock", { p_tenant_id: T, p_id: p.id });
      assert.equal(ahora.existencia, 10, "la línea válida tampoco se descontó");
      const { rows } = await db.query("select count(*)::int as c from ventas where id = $1", [ventaId]);
      assert.equal(rows[0].c, 0);
    });

    test("no bloquea la venta por stock, pero avisa", async () => {
      const p = (await crear({ p_cantidad_inicial: 3, p_stock_minimo: 2, p_nombre: "Huevos" })).producto;
      const r = await rpcOk(rpc, "registrar_venta", {
        p_id: id(), p_tenant_id: T, p_usuario_id: U, p_metodo_pago: "efectivo",
        p_lineas: [{ productoId: p.id, cantidad: 5 }]
      });
      assert.equal(r.ok, true);
      assert.equal(r.alertas.length, 1);
      assert.equal(r.alertas[0].tipo, "negativo");
      assert.equal(r.alertas[0].existencia, -2);
    });

    test("en efectivo, lo recibido tiene que alcanzar", async () => {
      const p = (await crear({ p_precio: 10000 })).producto;
      const r = await rpcOk(rpc, "registrar_venta", {
        p_id: id(), p_tenant_id: T, p_usuario_id: U, p_metodo_pago: "efectivo",
        p_recibido: 5000, p_lineas: [{ productoId: p.id, cantidad: 1 }]
      });
      assert.equal(r.ok, false);
      assert.equal(r.error, "recibido_insuficiente");
      assert.equal(r.total, 10000);
    });
  });

  describe("resumen_tablero", () => {
    test("suma lo vendido hoy y marca lo que hay que pedir", async () => {
      const r = await rpcOk(rpc, "resumen_tablero", { p_tenant_id: T });
      const { rows: [s] } = await db.query(
        "select coalesce(sum(total),0)::float as total, count(*)::int as n from ventas where tenant_id = $1",
        [T]
      );
      assert.equal(r.hoy.ventas, s.total);
      assert.equal(r.hoy.transacciones, s.n);
      assert.equal(r.porHora.length, 24);
      assert.equal(r.ultimos7Dias.length, 7);
      assert.ok(r.reabastecer.some((x) => x.nombre === "Huevos"), "los huevos en negativo deben aparecer");
      assert.ok(r.hoy.margenPct > 0 && r.hoy.margenPct < 100);

      // Kilos y unidades van por separado: en esta base se vendieron 0,85 kg de banano.
      assert.equal(r.hoy.kilos, 0.85);
      assert.ok(Number.isInteger(r.hoy.unidades));
      assert.ok(r.ultimasVentas.every((v) => v.productos >= 1));
    });
  });

  describe("seguridad", () => {
    test("la anon key no puede leer ventas ni llamar funciones", async () => {
      await db.exec("set role anon");
      try {
        await assert.rejects(db.query("select * from ventas"));
        await assert.rejects(db.query(`select resumen_tablero('${T}')`));
      } finally {
        await db.exec("reset role");
      }
    });
  });
});

describe("semilla de demostración", () => {
  test("carga y deja el tablero con algo que decir", async () => {
    const db = await crearBaseLocal({ semillaDemo: true });
    try {
      const r = await rpcOk(crearRpcLocal(db), "resumen_tablero", { p_tenant_id: T });
      assert.equal(r.inventario.productos, 18);
      assert.ok(r.inventario.agotados >= 1, "el queso tiene que estar agotado");
      assert.ok(r.reabastecer.length >= 2);
      assert.ok(r.quietos.some((q) => q.nombre.startsWith("Salsa")), "la salsa es la plata quieta");
      assert.ok(r.merma7d.registros === 3);
      assert.ok(r.top.length === 5);
      const { rows: [neg] } = await db.query("select count(*)::int as c from existencias where cantidad < 0");
      assert.equal(neg.c, 0, "la demo no deja existencias negativas");
    } finally {
      await db.close();
    }
  });
});

import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { crearBaseLocal, crearRpcLocal } from "../local.js";

// Catálogo progresivo: un código desconocido se registra desde la caja y
// bodega lo completa después.

const T = "00000000-0000-0000-0000-000000000001";
const U = "00000000-0000-0000-0000-0000000000de";
let n = 0;
const id = () => `40000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;

async function rpcOk(rpc, nombre, args) {
  const { data, error } = await rpc(nombre, args);
  if (error) throw new Error(`${nombre}: ${error.message}`);
  return data;
}

describe("registro desde la caja (SQL)", () => {
  let db, rpc;

  before(async () => {
    db = await crearBaseLocal();
    rpc = crearRpcLocal(db);
  });
  after(() => db.close());

  const rapido = (extra = {}) => rpcOk(rpc, "crear_producto_rapido", {
    p_id: id(), p_tenant_id: T, p_usuario_id: U,
    p_nombre: "Galletas de caja", p_precio: 2500, p_codigo: String(7707000000000 + n), ...extra
  });

  test("queda creado sin stock, sin categoría y marcado por revisar", async () => {
    const r = await rapido({ p_codigo: "7707000000100" });
    assert.equal(r.ok, true);
    assert.equal(r.producto.porRevisar, true);
    assert.equal(r.producto.categoria, "Sin categoría");
    assert.equal(Number(r.producto.existencia), 0);
    assert.equal(Number(r.producto.costo), 0);

    const lista = await rpcOk(rpc, "listar_productos", { p_tenant_id: T });
    assert.equal(lista.find((p) => p.id === r.producto.id).porRevisar, true);
  });

  test("un código que ya existe no crea otro ni lo marca por revisar", async () => {
    const primero = await rapido({ p_codigo: "7707000000200", p_nombre: "Original" });
    await rpcOk(rpc, "completar_producto", { p_tenant_id: T, p_id: primero.producto.id, p_categoria: "Abarrotes" });

    const otra = await rapido({ p_codigo: "7707000000200", p_nombre: "Copia" });
    assert.equal(otra.ok, false);
    assert.equal(otra.error, "codigo_duplicado");
    assert.equal(otra.producto.id, primero.producto.id);

    const deNuevo = await rpcOk(rpc, "producto_con_stock", { p_tenant_id: T, p_id: primero.producto.id });
    assert.equal(deNuevo.porRevisar, false);
  });

  test("reintentar con el mismo id no duplica", async () => {
    const args = { p_id: id(), p_tenant_id: T, p_usuario_id: U, p_nombre: "Reintento", p_precio: 1000, p_codigo: "7707000000300" };
    const a = await rpcOk(rpc, "crear_producto_rapido", args);
    const b = await rpcOk(rpc, "crear_producto_rapido", args);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(b.producto.id, a.producto.id);
    assert.equal(b.producto.porRevisar, true);
  });

  test("completar pone los datos y quita la marca; precio cero no pasa", async () => {
    const { producto } = await rapido({ p_codigo: "7707000000400" });

    const malo = await rpcOk(rpc, "completar_producto", { p_tenant_id: T, p_id: producto.id, p_precio: 0 });
    assert.equal(malo.error, "precio_invalido");

    const r = await rpcOk(rpc, "completar_producto", {
      p_tenant_id: T, p_id: producto.id, p_categoria: "Abarrotes", p_costo: 1800, p_stock_minimo: 6
    });
    assert.equal(r.ok, true);
    assert.equal(r.producto.porRevisar, false);
    assert.equal(r.producto.categoria, "Abarrotes");
    assert.equal(Number(r.producto.costo), 1800);
    assert.equal(Number(r.producto.stockMinimo), 6);
    assert.equal(r.producto.nombre, "Galletas de caja");

    const noHay = await rpcOk(rpc, "completar_producto", { p_tenant_id: T, p_id: id(), p_costo: 1 });
    assert.equal(noHay.error, "no_encontrado");
  });
});

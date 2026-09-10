import { test } from "node:test";
import assert from "node:assert/strict";
import { leerCodigoBalanza } from "../balanza.js";

// 2 F IIIII VVVVV C  ->  prefijo, marca, producto, valor, verificador
test("saca el peso de un código de balanza", () => {
  const r = leerCodigoBalanza("2012345008500");
  assert.equal(r.esDeBalanza, true);
  assert.equal(r.codigoProducto, "12345");
  assert.equal(r.pesoKg, 0.85);
  assert.equal(r.precio, null);
});

test("saca el precio cuando la marca lo indica", () => {
  const r = leerCodigoBalanza("2312345045000");
  assert.equal(r.precio, 4500);
  assert.equal(r.pesoKg, null);
});

test("un EAN normal pasa derecho", () => {
  const r = leerCodigoBalanza("7702001010011");
  assert.equal(r.esDeBalanza, false);
  assert.equal(r.codigoProducto, "7702001010011");
});

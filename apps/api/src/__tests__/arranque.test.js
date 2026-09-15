import { test, before, after } from "node:test";
import assert from "node:assert/strict";

// Levanta la API completa —todos los módulos, las rutas, el manejo de errores—
// contra la base local en memoria, y le hace peticiones de verdad.
//
// Existe por un error concreto: al pasar de Postgres directo a la REST de
// Supabase quedó un import a un archivo borrado. Las pruebas unitarias no
// importan app.js, así que todo pasaba en verde con una API que no arrancaba.
process.env.DATOS = "local";
process.env.DATOS_LOCAL_EN_MEMORIA = "1";

let servidor;
let base;
let cerrarBase = async () => {};

before(async () => {
  const { crearApp } = await import("../app.js");
  const { supabase } = await import("../plataforma/supabase.js");
  cerrarBase = async () => supabase._db?.close();

  servidor = crearApp().listen(0);
  await new Promise((listo) => servidor.once("listening", listo));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  await new Promise((listo) => servidor.close(listo));
  await cerrarBase();
});

test("la API arranca con todos sus módulos", async () => {
  const r = await fetch(`${base}/salud`);
  assert.equal(r.status, 200);
  assert.equal((await r.json()).datos, "local");
});

test("el catálogo responde con la semilla de demo", async () => {
  const r = await fetch(`${base}/catalogo/productos`);
  const productos = await r.json();
  assert.equal(r.status, 200, JSON.stringify(productos));
  assert.equal(productos.length, 18);
});

test("un código desconocido responde 404 con el código para crearlo", async () => {
  const r = await fetch(`${base}/catalogo/productos/codigo/7700000000000`);
  const cuerpo = await r.json();
  assert.equal(r.status, 404);
  assert.equal(cuerpo.error, "producto_no_registrado");
  assert.equal(cuerpo.detalle.codigo, "7700000000000");
});

test("datos con la forma equivocada responden 400, no 500", async () => {
  const r = await fetch(`${base}/catalogo/productos`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "Idempotency-Key": "01a08c56-f6dd-75c1-b455-9a85929daf99"
    },
    body: JSON.stringify({ unidad: "unidad", precio: 1000 })
  });
  const cuerpo = await r.json();
  assert.equal(r.status, 400);
  assert.equal(cuerpo.campo, "nombre");
});

test("el tablero responde", async () => {
  const r = await fetch(`${base}/tablero/resumen`);
  const d = await r.json();
  assert.equal(r.status, 200, JSON.stringify(d));
  assert.equal(typeof d.hoy.ventas, "number");
  assert.equal(d.porHora.length, 24);
});

import { test, before, after } from "node:test";
import assert from "node:assert/strict";

// Levanta la API completa —todos los módulos, las rutas, el manejo de errores,
// el login y los permisos— contra la base local en memoria, y le hace
// peticiones de verdad.
//
// Existe por un error concreto: al pasar de Postgres directo a la REST de
// Supabase quedó un import a un archivo borrado. Las pruebas unitarias no
// importan app.js, así que todo pasaba en verde con una API que no arrancaba.
process.env.DATOS = "local";
process.env.DATOS_LOCAL_EN_MEMORIA = "1";
// En "false" y no borrada: config.js solo toma del .env lo que no esté definido,
// y el .env de desarrollo de cada uno puede traerla en true.
process.env.AUTH_DESACTIVADA = "false";

let servidor;
let base;
let codigoInstalacion;
let cerrarBase = async () => {};

const ADMIN = { cedula: "1023456789", nombre: "Marta Ríos", clave: "canasta-verde-17" };
const CAJERO = { cedula: "98765432", nombre: "Luis Caja", rol: "cajero", clave: "temporal-2024" };

before(async () => {
  const { crearApp } = await import("../app.js");
  const { supabase } = await import("../plataforma/supabase.js");
  const identidad = (await import("../modulos/identidad/index.js")).default;
  cerrarBase = async () => supabase._db?.close();
  codigoInstalacion = await identidad.prepararInstalacion();

  servidor = crearApp().listen(0);
  await new Promise((listo) => servidor.once("listening", listo));
  base = `http://127.0.0.1:${servidor.address().port}`;
});

after(async () => {
  await new Promise((listo) => servidor.close(listo));
  await cerrarBase();
});

async function pedir(metodo, ruta, { cuerpo, token, cookie, sinJson = false } = {}) {
  const r = await fetch(base + ruta, {
    method: metodo,
    headers: {
      ...(cuerpo !== undefined && !sinJson ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(cookie ? { cookie: `mv_sesion=${cookie}` } : {}),
      "Idempotency-Key": "01a08c56-f6dd-75c1-b455-9a85929daf99"
    },
    body: cuerpo === undefined ? undefined : typeof cuerpo === "string" ? cuerpo : JSON.stringify(cuerpo)
  });
  const texto = await r.text();
  const cookieNueva = (r.headers.getSetCookie?.() ?? [])
    .map((c) => c.match(/^mv_sesion=([^;]*)/)?.[1])
    .find(Boolean);
  return {
    estado: r.status,
    cuerpo: texto ? JSON.parse(texto) : null,
    setCookie: r.headers.getSetCookie?.() ?? [],
    cookie: cookieNueva
  };
}

const sesiones = {};

test("la API arranca con todos sus módulos", async () => {
  const r = await pedir("GET", "/salud");
  assert.equal(r.estado, 200);
  assert.equal(r.cuerpo.datos, "local");
});

test("sin sesión no se ve nada", async () => {
  assert.equal((await pedir("GET", "/catalogo/productos")).estado, 401);
  assert.equal((await pedir("GET", "/tablero/resumen")).estado, 401);
  assert.equal((await pedir("GET", "/catalogo/productos", { token: "inventado.no.firmado" })).estado, 401);
});

test("instalación: pide el código del servidor para crear el primer administrador", async () => {
  assert.equal((await pedir("GET", "/auth/estado")).cuerpo.necesitaConfiguracion, true);
  assert.match(codigoInstalacion, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  const mal = await pedir("POST", "/auth/primer-administrador", { cuerpo: { ...ADMIN, codigo: "AAAA-BBBB" } });
  assert.equal(mal.estado, 400);
  assert.equal(mal.cuerpo.campo, "codigo");

  const r = await pedir("POST", "/auth/primer-administrador", {
    cuerpo: { ...ADMIN, codigo: codigoInstalacion.toLowerCase() }
  });
  assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.usuario.rol, "administrador");
  assert.equal(r.cuerpo.usuario.claveHash, undefined);
  assert.equal(r.cuerpo.tokenSesion, undefined, "el token de sesión solo va en la cookie");

  const cookie = r.setCookie.find((c) => c.startsWith("mv_sesion="));
  assert.match(cookie, /HttpOnly/i);
  assert.match(cookie, /SameSite=Strict/i);
  assert.match(cookie, /Path=\/api\/auth/i);

  sesiones.admin = { token: r.cuerpo.acceso, cookie: r.cookie };

  const otra = await pedir("POST", "/auth/primer-administrador", { cuerpo: { ...ADMIN, codigo: codigoInstalacion } });
  assert.equal(otra.estado, 409);
  assert.equal((await pedir("GET", "/auth/estado")).cuerpo.necesitaConfiguracion, false);
});

test("el administrador ve el catálogo y el tablero", async () => {
  const { token } = sesiones.admin;
  const productos = await pedir("GET", "/catalogo/productos", { token });
  assert.equal(productos.estado, 200, JSON.stringify(productos.cuerpo));
  assert.equal(productos.cuerpo.length, 18);

  const t = await pedir("GET", "/tablero/resumen", { token });
  assert.equal(t.estado, 200, JSON.stringify(t.cuerpo));
  assert.equal(t.cuerpo.porHora.length, 24);
});

test("un código desconocido responde 404 con el código para crearlo", async () => {
  const r = await pedir("GET", "/catalogo/productos/codigo/7700000000000", { token: sesiones.admin.token });
  assert.equal(r.estado, 404);
  assert.equal(r.cuerpo.error, "producto_no_registrado");
  assert.equal(r.cuerpo.detalle.codigo, "7700000000000");
});

test("datos con la forma equivocada responden 400, no 500", async () => {
  const r = await pedir("POST", "/catalogo/productos", {
    token: sesiones.admin.token, cuerpo: { unidad: "unidad", precio: 1000 }
  });
  assert.equal(r.estado, 400);
  assert.equal(r.cuerpo.campo, "nombre");
});

test("el administrador crea un cajero; contraseñas débiles y cédulas repetidas no pasan", async () => {
  const { token } = sesiones.admin;

  const debil = await pedir("POST", "/auth/usuarios", { token, cuerpo: { ...CAJERO, clave: "12345678" } });
  assert.equal(debil.estado, 400);
  assert.equal(debil.cuerpo.campo, "clave");

  const conCedula = await pedir("POST", "/auth/usuarios", { token, cuerpo: { ...CAJERO, clave: `x${CAJERO.cedula}` } });
  assert.equal(conCedula.estado, 400);

  const r = await pedir("POST", "/auth/usuarios", { token, cuerpo: { ...CAJERO, cedula: "98.765.432" } });
  assert.equal(r.estado, 201, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.cedula, "98765432");
  assert.equal(r.cuerpo.debeCambiarClave, true);
  sesiones.cajeroId = r.cuerpo.id;

  const repetida = await pedir("POST", "/auth/usuarios", { token, cuerpo: CAJERO });
  assert.equal(repetida.estado, 409);
  assert.equal(repetida.cuerpo.campo, "cedula");
});

test("el cajero entra, tiene que cambiar la contraseña, y después solo vende", async () => {
  const entra = await pedir("POST", "/auth/ingresar", { cuerpo: { cedula: CAJERO.cedula, clave: CAJERO.clave } });
  assert.equal(entra.estado, 200, JSON.stringify(entra.cuerpo));
  assert.equal(entra.cuerpo.usuario.debeCambiarClave, true);

  const bloqueado = await pedir("GET", "/catalogo/productos", { token: entra.cuerpo.acceso });
  assert.equal(bloqueado.estado, 403);
  assert.equal(bloqueado.cuerpo.error, "debe_cambiar_clave");

  const cambio = await pedir("POST", "/auth/clave", {
    token: entra.cuerpo.acceso, cuerpo: { actual: CAJERO.clave, nueva: "mi-clave-de-caja" }
  });
  assert.equal(cambio.estado, 200, JSON.stringify(cambio.cuerpo));
  assert.equal(cambio.cuerpo.usuario.debeCambiarClave, false);
  const token = cambio.cuerpo.acceso;

  assert.equal((await pedir("GET", "/catalogo/productos", { token })).estado, 200);
  assert.equal((await pedir("GET", "/tablero/resumen", { token })).estado, 403);
  assert.equal((await pedir("GET", "/auth/usuarios", { token })).estado, 403);
  assert.equal((await pedir("POST", "/catalogo/productos", { token, cuerpo: {} })).estado, 403);
  assert.equal((await pedir("POST", "/inventario/movimientos", { token, cuerpo: {} })).estado, 403);
  // A ventas sí entra: responde por los datos, no por el permiso.
  assert.equal((await pedir("POST", "/ventas", { token, cuerpo: {} })).estado, 400);
});

test("la contraseña equivocada no dice si la cédula existe, y cinco fallos bloquean", async () => {
  const noExiste = await pedir("POST", "/auth/ingresar", { cuerpo: { cedula: "11122233", clave: "lo-que-sea-1" } });
  const malaClave = await pedir("POST", "/auth/ingresar", { cuerpo: { cedula: CAJERO.cedula, clave: "lo-que-sea-1" } });
  assert.equal(noExiste.estado, 401);
  assert.equal(malaClave.estado, 401);
  assert.equal(noExiste.cuerpo.mensaje, malaClave.cuerpo.mensaje);

  let r;
  for (let i = 0; i < 4; i++) {
    r = await pedir("POST", "/auth/ingresar", { cuerpo: { cedula: CAJERO.cedula, clave: "otra-mala-" + i } });
  }
  assert.equal(r.estado, 423);
  assert.equal(r.cuerpo.error, "cuenta_bloqueada");

  // Bloqueada, ni la contraseña correcta entra.
  const correcta = await pedir("POST", "/auth/ingresar", { cuerpo: { cedula: CAJERO.cedula, clave: "mi-clave-de-caja" } });
  assert.equal(correcta.estado, 423);
});

test("renovar cambia la cookie; la vieja ya no sirve y salir cierra la sesión", async () => {
  const { cookie } = sesiones.admin;

  const sinJson = await pedir("POST", "/auth/renovar", { cookie, cuerpo: "{}", sinJson: true });
  assert.equal(sinJson.estado, 400);

  const r = await pedir("POST", "/auth/renovar", { cookie, cuerpo: {} });
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.ok(r.cookie && r.cookie !== cookie);
  assert.equal(r.cuerpo.usuario.cedula, ADMIN.cedula);

  // Enseguida con la vieja: otra pestaña que llegó tarde, no un robo.
  assert.equal((await pedir("POST", "/auth/renovar", { cookie, cuerpo: {} })).estado, 409);

  assert.equal((await pedir("POST", "/auth/salir", { cookie: r.cookie, cuerpo: {} })).estado, 204);
  assert.equal((await pedir("POST", "/auth/renovar", { cookie: r.cookie, cuerpo: {} })).estado, 401);
  assert.equal((await pedir("POST", "/auth/renovar", { cuerpo: {} })).estado, 401);
});

test("el administrador desactiva al cajero; no puede quitarse a sí mismo", async () => {
  const entra = await pedir("POST", "/auth/ingresar", { cuerpo: { cedula: ADMIN.cedula, clave: ADMIN.clave } });
  const { acceso: token, usuario } = entra.cuerpo;

  const aSiMismo = await pedir("PATCH", `/auth/usuarios/${usuario.id}`, { token, cuerpo: { activo: false } });
  assert.equal(aSiMismo.estado, 409);

  const r = await pedir("PATCH", `/auth/usuarios/${sesiones.cajeroId}`, { token, cuerpo: { activo: false } });
  assert.equal(r.estado, 200, JSON.stringify(r.cuerpo));
  assert.equal(r.cuerpo.activo, false);

  const lista = await pedir("GET", "/auth/usuarios", { token });
  assert.equal(lista.cuerpo.length, 2);
  assert.ok(lista.cuerpo.every((u) => u.claveHash === undefined));
});

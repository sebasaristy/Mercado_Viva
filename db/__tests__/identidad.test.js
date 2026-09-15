import { test, describe, before, after } from "node:test";
import assert from "node:assert/strict";
import { crearBaseLocal, crearRpcLocal } from "../local.js";

// Las funciones de usuarios y sesiones contra un Postgres real.
// Las huellas aquí son texto cualquiera: el hash se calcula en la API.

const T = "00000000-0000-0000-0000-000000000001";
let n = 0;
const id = () => `30000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const enUnMes = () => new Date(Date.now() + 30 * 864e5).toISOString();

async function rpcOk(rpc, nombre, args) {
  const { data, error } = await rpc(nombre, args);
  if (error) throw new Error(`${nombre}: ${error.message}`);
  return data;
}

describe("identidad (SQL)", () => {
  let db, rpc;

  before(async () => {
    db = await crearBaseLocal();
    rpc = crearRpcLocal(db);
  });
  after(() => db.close());

  const crearUsuario = (extra = {}) => rpcOk(rpc, "crear_usuario", {
    p_id: id(), p_tenant_id: T, p_cedula: String(1000000 + n), p_nombre: "Ana Pérez",
    p_rol: "cajero", p_clave_hash: "huella", ...extra
  });

  test("sin usuarios, hay_usuarios es falso; con uno, verdadero", async () => {
    assert.equal(await rpcOk(rpc, "hay_usuarios", { p_tenant_id: T }), false);
    await crearUsuario({ p_rol: "administrador", p_debe_cambiar_clave: false });
    assert.equal(await rpcOk(rpc, "hay_usuarios", { p_tenant_id: T }), true);
  });

  test("la cédula no se repite, y lo público no trae la huella", async () => {
    const r = await crearUsuario({ p_cedula: "55555555" });
    assert.equal(r.ok, true);
    assert.equal(r.usuario.claveHash, undefined);
    assert.equal(r.usuario.debeCambiarClave, true);
    const otra = await crearUsuario({ p_cedula: "55555555" });
    assert.equal(otra.error, "cedula_duplicada");

    const lista = await rpcOk(rpc, "listar_usuarios", { p_tenant_id: T });
    assert.ok(lista.every((u) => u.claveHash === undefined));
  });

  test("cinco fallos seguidos bloquean la cuenta, y un acierto la limpia", async () => {
    const { usuario } = await crearUsuario();
    let r;
    for (let i = 0; i < 4; i++) {
      r = await rpcOk(rpc, "registrar_ingreso", { p_usuario_id: usuario.id, p_exito: false });
      assert.equal(r.bloqueadoHasta, null);
    }
    r = await rpcOk(rpc, "registrar_ingreso", { p_usuario_id: usuario.id, p_exito: false });
    assert.ok(new Date(r.bloqueadoHasta) > new Date());

    await rpcOk(rpc, "registrar_ingreso", { p_usuario_id: usuario.id, p_exito: true });
    const u = await rpcOk(rpc, "usuario_para_ingresar", { p_tenant_id: T, p_cedula: usuario.cedula });
    assert.equal(u.bloqueadoHasta, null);
    assert.ok(u.ultimoIngreso);
  });

  test("rotar: cada token sirve una vez; reutilizarlo después cierra todo", async () => {
    const { usuario } = await crearUsuario();
    await rpcOk(rpc, "crear_sesion", {
      p_id: id(), p_usuario_id: usuario.id, p_token_hash: "t1", p_expira_en: enUnMes()
    });

    const r1 = await rpcOk(rpc, "rotar_sesion", {
      p_token_hash: "t1", p_nuevo_id: id(), p_nuevo_hash: "t2", p_expira_en: enUnMes()
    });
    assert.equal(r1.ok, true);
    assert.equal(r1.usuario.id, usuario.id);

    // Enseguida: dos pestañas renovando a la vez. No es un robo.
    const carrera = await rpcOk(rpc, "rotar_sesion", {
      p_token_hash: "t1", p_nuevo_id: id(), p_nuevo_hash: "tx", p_expira_en: enUnMes()
    });
    assert.equal(carrera.error, "carrera");

    // Pasado el margen, el mismo token viejo es una copia robada.
    await db.query("update sesiones set revocada_en = now() - interval '1 minute' where token_hash = 't1'");
    const robo = await rpcOk(rpc, "rotar_sesion", {
      p_token_hash: "t1", p_nuevo_id: id(), p_nuevo_hash: "t3", p_expira_en: enUnMes()
    });
    assert.equal(robo.error, "sesion_reutilizada");

    // Y la sesión buena también quedó cerrada.
    const legitima = await rpcOk(rpc, "rotar_sesion", {
      p_token_hash: "t2", p_nuevo_id: id(), p_nuevo_hash: "t4", p_expira_en: enUnMes()
    });
    assert.equal(legitima.ok, false);
  });

  test("una sesión vencida o de un usuario desactivado no se renueva", async () => {
    const { usuario } = await crearUsuario();
    await rpcOk(rpc, "crear_sesion", {
      p_id: id(), p_usuario_id: usuario.id, p_token_hash: "vencida",
      p_expira_en: new Date(Date.now() - 1000).toISOString()
    });
    const r = await rpcOk(rpc, "rotar_sesion", {
      p_token_hash: "vencida", p_nuevo_id: id(), p_nuevo_hash: "v2", p_expira_en: enUnMes()
    });
    assert.equal(r.error, "sesion_vencida");

    await rpcOk(rpc, "crear_sesion", {
      p_id: id(), p_usuario_id: usuario.id, p_token_hash: "activa", p_expira_en: enUnMes()
    });
    await db.query("update usuarios set activo = false where id = $1", [usuario.id]);
    const r2 = await rpcOk(rpc, "rotar_sesion", {
      p_token_hash: "activa", p_nuevo_id: id(), p_nuevo_hash: "a2", p_expira_en: enUnMes()
    });
    assert.equal(r2.error, "usuario_inactivo");
  });

  test("no se puede quitar el último administrador ni desactivarse a sí mismo", async () => {
    const tenant = "00000000-0000-0000-0000-0000000000a2";
    const { usuario: admin } = await crearUsuario({ p_tenant_id: tenant, p_rol: "administrador" });
    const { usuario: cajero } = await crearUsuario({ p_tenant_id: tenant });

    const solo = await rpcOk(rpc, "actualizar_usuario", {
      p_tenant_id: tenant, p_id: admin.id, p_actor_id: cajero.id, p_rol: "cajero"
    });
    assert.equal(solo.error, "ultimo_administrador");

    const asiMismo = await rpcOk(rpc, "actualizar_usuario", {
      p_tenant_id: tenant, p_id: admin.id, p_actor_id: admin.id, p_activo: false
    });
    assert.equal(asiMismo.error, "no_sobre_si_mismo");
  });

  test("restablecer la contraseña obliga a cambiarla y cierra sus sesiones", async () => {
    const { usuario } = await crearUsuario({ p_debe_cambiar_clave: false });
    await rpcOk(rpc, "crear_sesion", {
      p_id: id(), p_usuario_id: usuario.id, p_token_hash: "antes", p_expira_en: enUnMes()
    });

    const r = await rpcOk(rpc, "actualizar_usuario", {
      p_tenant_id: T, p_id: usuario.id, p_actor_id: id(), p_clave_hash: "nueva"
    });
    assert.equal(r.usuario.debeCambiarClave, true);

    const rot = await rpcOk(rpc, "rotar_sesion", {
      p_token_hash: "antes", p_nuevo_id: id(), p_nuevo_hash: "x", p_expira_en: enUnMes()
    });
    assert.equal(rot.ok, false);
  });

  test("cambiar la clave propia mantiene la sesión actual y cierra las otras", async () => {
    const { usuario } = await crearUsuario();
    const actual = id();
    await rpcOk(rpc, "crear_sesion", { p_id: actual, p_usuario_id: usuario.id, p_token_hash: "aqui", p_expira_en: enUnMes() });
    await rpcOk(rpc, "crear_sesion", { p_id: id(), p_usuario_id: usuario.id, p_token_hash: "otro", p_expira_en: enUnMes() });

    const r = await rpcOk(rpc, "cambiar_clave", {
      p_usuario_id: usuario.id, p_clave_hash: "propia", p_sesion_id: actual
    });
    assert.equal(r.usuario.debeCambiarClave, false);

    const { rows } = await db.query(
      "select token_hash, revocada_en is null as abierta from sesiones where usuario_id = $1 order by token_hash",
      [usuario.id]
    );
    assert.deepEqual(rows.map((f) => [f.token_hash, f.abierta]), [["aqui", true], ["otro", false]]);
  });

  test("anon no puede llamar las funciones de identidad", async () => {
    await db.exec("set role anon");
    try {
      await assert.rejects(db.query(`select hay_usuarios('${T}')`), /permission denied/);
      await assert.rejects(db.query("select * from usuarios"), /permission denied|row-level/);
    } finally {
      await db.exec("reset role");
    }
  });
});

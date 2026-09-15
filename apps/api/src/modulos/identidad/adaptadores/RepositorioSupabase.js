import { supabase, oTirar } from "../../../plataforma/supabase.js";

// Cada operación es una función de db/migraciones/008_identidad.sql. Las que
// tocan dos cosas a la vez (rotar una sesión, desactivar a alguien y cerrarle
// las sesiones) pasan en una sola transacción adentro de la base.
const llamar = async (funcion, argumentos, contexto) =>
  oTirar(await supabase.rpc(funcion, argumentos), contexto);

export function crearRepositorioSupabase() {
  return {
    hayUsuarios: (tenantId) =>
      llamar("hay_usuarios", { p_tenant_id: tenantId }, "ver si hay usuarios"),

    buscarParaIngresar: (tenantId, { cedula, id }) =>
      llamar("usuario_para_ingresar", {
        p_tenant_id: tenantId, p_cedula: cedula ?? null, p_id: id ?? null
      }, "buscar usuario"),

    registrarIngreso: (usuarioId, exito) =>
      llamar("registrar_ingreso", { p_usuario_id: usuarioId, p_exito: exito }, "registrar ingreso"),

    crearSesion: (s) =>
      llamar("crear_sesion", {
        p_id: s.id, p_usuario_id: s.usuarioId, p_token_hash: s.tokenHash,
        p_expira_en: s.expiraEn, p_agente: s.agente ?? null
      }, "crear sesión"),

    rotarSesion: (s) =>
      llamar("rotar_sesion", {
        p_token_hash: s.tokenHash, p_nuevo_id: s.nuevoId,
        p_nuevo_hash: s.nuevoHash, p_expira_en: s.expiraEn
      }, "renovar sesión"),

    cerrarSesion: (tokenHash) =>
      llamar("cerrar_sesion", { p_token_hash: tokenHash }, "cerrar sesión"),

    listarUsuarios: (tenantId) =>
      llamar("listar_usuarios", { p_tenant_id: tenantId }, "listar usuarios"),

    crearUsuario: (u) =>
      llamar("crear_usuario", {
        p_id: u.id, p_tenant_id: u.tenantId, p_cedula: u.cedula, p_nombre: u.nombre,
        p_rol: u.rol, p_clave_hash: u.claveHash, p_debe_cambiar_clave: u.debeCambiarClave
      }, "crear usuario"),

    // Lo que viene undefined no se manda, y la función lo deja como estaba.
    actualizarUsuario: (u) =>
      llamar("actualizar_usuario", {
        p_tenant_id: u.tenantId, p_id: u.id, p_actor_id: u.actorId,
        p_nombre: u.nombre, p_rol: u.rol, p_activo: u.activo, p_clave_hash: u.claveHash
      }, "actualizar usuario"),

    cambiarClave: (c) =>
      llamar("cambiar_clave", {
        p_usuario_id: c.usuarioId, p_clave_hash: c.claveHash, p_sesion_id: c.sesionId ?? null
      }, "cambiar contraseña")
  };
}

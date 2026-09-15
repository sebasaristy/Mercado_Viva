import { nuevoId } from "@mv/compartido";
import { ErrorIdentidad } from "../dominio/errores.js";
import { problemaConLaClave } from "../dominio/reglas.js";

// Lo que hace el administrador con las cuentas del equipo.

const RESPUESTAS = {
  cedula_duplicada: ["Ya hay un usuario con esa cédula.", 409, "cedula"],
  ultimo_administrador: ["Tiene que quedar al menos un administrador activo.", 409, "rol"],
  no_sobre_si_mismo: ["No puedes desactivarte ni cambiarte el rol. Pídeselo a otro administrador.", 409, null],
  usuario_no_encontrado: ["Ese usuario no existe.", 404, null]
};

function rechazo(codigo) {
  const [mensaje, estado, campo] = RESPUESTAS[codigo] ?? ["No se pudo guardar el usuario.", 409, null];
  return new ErrorIdentidad(mensaje, codigo, estado, { campo });
}

function exigirClaveValida(clave, cedula, campo) {
  const problema = problemaConLaClave(clave, { cedula });
  if (problema) throw new ErrorIdentidad(problema, "clave_debil", 400, { campo });
}

export function crearGestionDeUsuarios({ repositorio, claves, sesiones, instalacion, tenantId }) {
  async function primerAdministrador({ codigo, cedula, nombre, clave, agente }) {
    if (!(await instalacion.preparar())) {
      throw new ErrorIdentidad("Esta tienda ya tiene administrador. Entra con tu cédula.", "ya_configurada", 409);
    }
    if (!instalacion.coincide(codigo)) {
      throw new ErrorIdentidad(
        "El código no coincide. Está en la consola del servidor, donde arrancó la API.",
        "codigo_invalido", 400, { campo: "codigo" }
      );
    }
    exigirClaveValida(clave, cedula, "clave");

    const r = await repositorio.crearUsuario({
      id: nuevoId(), tenantId, cedula, nombre, rol: "administrador",
      claveHash: await claves.cifrarClave(clave),
      // La eligió la misma persona: no hay nada que cambiar.
      debeCambiarClave: false
    });
    if (!r.ok) throw rechazo(r.error);
    instalacion.marcarConfigurada();

    await repositorio.registrarIngreso(r.usuario.id, true);
    return sesiones.emitir(r.usuario, agente);
  }

  const listarUsuarios = (actor) => repositorio.listarUsuarios(actor.tenantId);

  async function crearUsuario(actor, { cedula, nombre, rol, clave }) {
    exigirClaveValida(clave, cedula, "clave");
    const r = await repositorio.crearUsuario({
      id: nuevoId(), tenantId: actor.tenantId, cedula, nombre, rol,
      claveHash: await claves.cifrarClave(clave),
      debeCambiarClave: true
    });
    if (!r.ok) throw rechazo(r.error);
    return r.usuario;
  }

  async function actualizarUsuario(actor, id, { nombre, rol, activo, clave }) {
    let claveHash;
    if (clave !== undefined) {
      const actual = await repositorio.buscarParaIngresar(actor.tenantId, { id });
      if (!actual) throw rechazo("usuario_no_encontrado");
      exigirClaveValida(clave, actual.cedula, "clave");
      claveHash = await claves.cifrarClave(clave);
    }

    const r = await repositorio.actualizarUsuario({
      tenantId: actor.tenantId, id, actorId: actor.id, nombre, rol, activo, claveHash
    });
    if (!r.ok) throw rechazo(r.error);
    return r.usuario;
  }

  return { primerAdministrador, listarUsuarios, crearUsuario, actualizarUsuario };
}

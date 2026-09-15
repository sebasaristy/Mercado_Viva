import { nuevoId } from "@mv/compartido";
import { ErrorIdentidad } from "../dominio/errores.js";
import { normalizarCedula, problemaConLaClave } from "../dominio/reglas.js";

// Entrar, renovar, salir y cambiar la contraseña propia.

// Mismo mensaje si la cédula no existe o si la contraseña está mal: decir cuál
// de las dos falló le confirma a un extraño qué cédulas tienen cuenta.
const credencialesInvalidas = () =>
  new ErrorIdentidad("La cédula o la contraseña no coinciden.", "credenciales_invalidas", 401);

const minutosHasta = (fecha) => Math.max(1, Math.ceil((new Date(fecha) - Date.now()) / 60000));

const cuentaBloqueada = (hasta) => new ErrorIdentidad(
  `Por seguridad la cuenta quedó bloqueada. Intenta de nuevo en ${minutosHasta(hasta)} min ` +
  "o pide al administrador que restablezca tu contraseña.",
  "cuenta_bloqueada", 423, { detalle: { bloqueadoHasta: hasta } }
);

const sinHuella = ({ claveHash: _c, bloqueadoHasta: _b, ...usuario }) => usuario;

export function crearSesiones({ repositorio, claves, tokens, tenantId, diasSesion }) {
  const vencimiento = () => new Date(Date.now() + diasSesion * 864e5);

  async function emitir(usuario, agente) {
    const tokenSesion = claves.tokenAleatorio();
    const sesionId = nuevoId();
    const expiraEn = vencimiento();
    await repositorio.crearSesion({
      id: sesionId,
      usuarioId: usuario.id,
      tokenHash: claves.huellaDeToken(tokenSesion),
      expiraEn: expiraEn.toISOString(),
      agente
    });
    return {
      usuario: sinHuella(usuario),
      acceso: await tokens.firmarAcceso(usuario, sesionId),
      tokenSesion,
      expiraEn
    };
  }

  async function ingresar({ cedula, clave, agente }) {
    const u = await repositorio.buscarParaIngresar(tenantId, { cedula: normalizarCedula(cedula) });

    if (!u) {
      await claves.verificarContraNada(clave);
      throw credencialesInvalidas();
    }
    if (u.bloqueadoHasta && new Date(u.bloqueadoHasta) > new Date()) {
      await claves.verificarContraNada(clave);
      throw cuentaBloqueada(u.bloqueadoHasta);
    }
    if (!(await claves.verificarClave(clave, u.claveHash))) {
      const r = await repositorio.registrarIngreso(u.id, false);
      if (r?.bloqueadoHasta) throw cuentaBloqueada(r.bloqueadoHasta);
      throw credencialesInvalidas();
    }
    // Después de verificar la contraseña: "desactivado" solo se le dice a quien
    // demostró ser esa persona.
    if (!u.activo) {
      throw new ErrorIdentidad(
        "Este usuario está desactivado. Habla con el administrador.", "usuario_inactivo", 403
      );
    }

    await repositorio.registrarIngreso(u.id, true);
    return emitir(u, agente);
  }

  async function renovar({ tokenSesion }) {
    if (!tokenSesion) {
      throw new ErrorIdentidad("No hay una sesión abierta en este equipo.", "sin_sesion", 401);
    }

    const nuevo = claves.tokenAleatorio();
    const sesionId = nuevoId();
    const expiraEn = vencimiento();
    const r = await repositorio.rotarSesion({
      tokenHash: claves.huellaDeToken(tokenSesion),
      nuevoId: sesionId,
      nuevoHash: claves.huellaDeToken(nuevo),
      expiraEn: expiraEn.toISOString()
    });

    if (!r.ok) {
      if (r.error === "carrera") {
        throw new ErrorIdentidad("La sesión se estaba renovando en otra pestaña.", "carrera", 409);
      }
      throw new ErrorIdentidad(
        r.error === "sesion_vencida" ? "Tu sesión venció. Vuelve a entrar." : "Tu sesión se cerró. Vuelve a entrar.",
        r.error, 401
      );
    }

    return {
      usuario: r.usuario,
      acceso: await tokens.firmarAcceso(r.usuario, sesionId),
      tokenSesion: nuevo,
      expiraEn
    };
  }

  async function salir({ tokenSesion }) {
    if (tokenSesion) await repositorio.cerrarSesion(claves.huellaDeToken(tokenSesion));
  }

  async function cambiarClave(actor, { actual, nueva }) {
    const u = await repositorio.buscarParaIngresar(actor.tenantId, { id: actor.id });
    if (!u || !u.activo) {
      throw new ErrorIdentidad("Tu sesión ya no es válida. Vuelve a entrar.", "sin_sesion", 401);
    }

    if (!(await claves.verificarClave(actual, u.claveHash))) {
      // Cuenta como intento fallido: un token robado no sirve para adivinar la clave.
      const r = await repositorio.registrarIngreso(u.id, false);
      if (r?.bloqueadoHasta) throw cuentaBloqueada(r.bloqueadoHasta);
      throw new ErrorIdentidad("La contraseña actual no es correcta.", "clave_actual_incorrecta", 400, { campo: "actual" });
    }

    const problema = problemaConLaClave(nueva, { cedula: u.cedula });
    if (problema) throw new ErrorIdentidad(problema, "clave_debil", 400, { campo: "nueva" });
    if (actual === nueva) {
      throw new ErrorIdentidad("La nueva contraseña tiene que ser distinta a la actual.", "clave_repetida", 400, { campo: "nueva" });
    }

    const r = await repositorio.cambiarClave({
      usuarioId: u.id,
      claveHash: await claves.cifrarClave(nueva),
      sesionId: actor.sesionId
    });
    return { usuario: r.usuario, acceso: await tokens.firmarAcceso(r.usuario, actor.sesionId) };
  }

  return { emitir, ingresar, renovar, salir, cambiarClave };
}

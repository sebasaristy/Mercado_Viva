import { create } from "zustand";
import { errorDeRespuesta, errorSinRed } from "./errores.js";

// Quién está usando este equipo.
//
// Tres piezas, cada una donde corresponde:
//  - El perfil (nombre, rol) en localStorage. No es secreto, y es lo que deja
//    abrir la app en la bodega sin señal sin volver a pedir la contraseña.
//  - El token de acceso (10 minutos) solo en memoria. Se pierde al cerrar la
//    app, y no importa: se pide otro.
//  - El token de sesión (semanas) en una cookie httpOnly que este código ni
//    siquiera puede leer. Un script inyectado no se lo puede llevar.
const PERFIL = "mv.usuario";

function leerPerfil() {
  try {
    return JSON.parse(localStorage.getItem(PERFIL));
  } catch {
    return null;
  }
}

function guardarPerfil(usuario) {
  try {
    if (usuario) localStorage.setItem(PERFIL, JSON.stringify(usuario));
    else localStorage.removeItem(PERFIL);
  } catch { /* modo privado: la sesión dura lo que dure la pestaña */ }
}

export const usarSesion = create(() => ({
  usuario: leerPerfil(),
  listo: false,
  necesitaConfiguracion: false
}));

let acceso = null;
let venceEn = 0;
let renovacionEnCurso = null;

function aplicar({ usuario, acceso: nuevo, segundosAcceso = 600 }) {
  acceso = nuevo;
  // Con el reloj de este equipo, no con la hora del servidor: si el celular
  // está atrasado, el token igual se renueva a tiempo.
  venceEn = Date.now() + segundosAcceso * 1000;
  guardarPerfil(usuario);
  usarSesion.setState({ usuario });
}

export function olvidarSesion() {
  acceso = null;
  venceEn = 0;
  guardarPerfil(null);
  usarSesion.setState({ usuario: null });
}

export function marcarDebeCambiarClave() {
  const { usuario } = usarSesion.getState();
  if (!usuario || usuario.debeCambiarClave) return;
  const actualizado = { ...usuario, debeCambiarClave: true };
  guardarPerfil(actualizado);
  usarSesion.setState({ usuario: actualizado });
}

async function postear(ruta, cuerpo = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`/api/auth${ruta}`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        "content-type": "application/json",
        ...(acceso ? { authorization: `Bearer ${acceso}` } : {})
      },
      body: JSON.stringify(cuerpo)
    });
  } catch {
    throw errorSinRed();
  }
  const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);
  if (!respuesta.ok) throw errorDeRespuesta(respuesta, datos);
  return datos;
}

// Una sola renovación a la vez. Si tres pantallas piden datos juntas con el
// token vencido, las tres esperan la misma; tres renovaciones seguidas con la
// misma cookie parecerían un robo y cerrarían la sesión.
export function renovar() {
  renovacionEnCurso ??= (async () => {
    try {
      for (let intento = 0; ; intento++) {
        try {
          aplicar(await postear("/renovar"));
          return;
        } catch (e) {
          if (e.codigo === "carrera" && intento < 2) {
            await new Promise((listo) => setTimeout(listo, 400));
            continue;
          }
          if (e.estado === 401) olvidarSesion();
          throw e;
        }
      }
    } finally {
      renovacionEnCurso = null;
    }
  })();
  return renovacionEnCurso;
}

// El token para la próxima petición. null si no hay sesión o no hay red:
// la petición sale sin token, falla por red, y la operación se guarda en la cola.
export async function tokenActual() {
  if (acceso && Date.now() < venceEn - 30_000) return acceso;
  if (!usarSesion.getState().usuario) return null;
  try {
    await renovar();
  } catch {
    return null;
  }
  return acceso;
}

export async function ingresar(cedula, clave) {
  aplicar(await postear("/ingresar", { cedula, clave }));
}

export async function crearPrimerAdministrador(datos) {
  aplicar(await postear("/primer-administrador", datos));
  usarSesion.setState({ necesitaConfiguracion: false });
}

export async function cambiarClave(actual, nueva) {
  await tokenActual();
  aplicar(await postear("/clave", { actual, nueva }));
}

export async function salir() {
  try {
    await postear("/salir");
  } catch {
    /* Sin red la cookie sigue viva en el servidor hasta que venza, pero este
       equipo ya no la usa: sin perfil guardado nunca se intenta renovar. */
  } finally {
    olvidarSesion();
  }
}

// Al abrir la app. Con perfil guardado entra de una, aunque no haya señal, y
// renueva por detrás. Sin perfil, pregunta si la tienda ya tiene administrador.
export async function arrancarSesion() {
  if (usarSesion.getState().usuario) {
    usarSesion.setState({ listo: true });
    renovar().catch(() => { /* sin red: se reintenta con la próxima petición */ });
    return;
  }
  try {
    const r = await fetch("/api/auth/estado", { cache: "no-store" });
    const d = await r.json();
    usarSesion.setState({ necesitaConfiguracion: Boolean(d.necesitaConfiguracion) });
  } catch {
    /* sin servidor: se muestra el ingreso, que explica que hace falta conexión */
  } finally {
    usarSesion.setState({ listo: true });
  }
}

import { enviarJson } from "../api/cliente.js";
import { usarSesion } from "../api/sesion.js";
import * as cola from "./cola.js";
import { pedirAlmacenamientoPersistente } from "./base.js";
import { usarConexion } from "./conexion.js";
import { refrescarCatalogo } from "./catalogo.js";

let subiendo = false;

export async function actualizarContadores() {
  usarConexion.getState().actualizar({
    pendientes: await cola.contarPendientes(),
    atascadas: await cola.atascadas()
  });
}

// Sube lo que quedó guardado sin conexión, en el orden en que ocurrió.
export async function subirPendientes() {
  const yo = usarSesion.getState().usuario;
  if (subiendo || !yo) return;
  subiendo = true;
  const estado = usarConexion.getState();

  try {
    const items = await cola.pendientes();
    if (items.length) estado.actualizar({ subiendo: true });

    for (const item of items) {
      if (item.proximoIntento > Date.now()) continue;
      // Lo de otra persona espera a que esa persona vuelva a entrar.
      if (item.usuarioId && item.usuarioId !== yo.id) continue;
      try {
        await enviarJson(item.ruta, item.cuerpo, item.id);
        await cola.marcarSubida(item.id);
        estado.actualizar({ hayServidor: true, ultimoContacto: new Date() });
      } catch (e) {
        // Sesión vencida: no es culpa de la operación. Queda como estaba y
        // se sube cuando la persona vuelva a entrar.
        if (e.estado === 401) break;
        await cola.marcarFallida(item.id, e, e.deRed);
        if (e.deRed) {
          estado.actualizar({ hayServidor: false });
          break;   // sin red no tiene sentido seguir intentando las demás
        }
      }
    }
  } finally {
    subiendo = false;
    usarConexion.getState().actualizar({ subiendo: false });
    await actualizarContadores();
  }
}

// No se confía en navigator.onLine: dice "en línea" con el wifi conectado a un
// router sin internet. Hay servidor cuando el servidor responde, no antes.
export async function comprobarServidor() {
  try {
    const r = await fetch("/api/salud", { cache: "no-store" });
    const hay = r.ok;
    usarConexion.getState().actualizar({
      hayServidor: hay,
      ...(hay ? { ultimoContacto: new Date() } : {})
    });
    return hay;
  } catch {
    usarConexion.getState().actualizar({ hayServidor: false });
    return false;
  }
}

export function arrancarSync() {
  pedirAlmacenamientoPersistente();

  const ciclo = async () => {
    if (await comprobarServidor()) await subirPendientes();
    else await actualizarContadores();
  };

  addEventListener("online", ciclo);
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ciclo();
  });
  setInterval(ciclo, 15000);

  // Al entrar alguien: se trae el catálogo y se sube lo suyo que esperaba.
  usarSesion.subscribe((ahora, antes) => {
    if (ahora.usuario?.id && ahora.usuario.id !== antes.usuario?.id) {
      refrescarCatalogo().catch(() => { /* sin servidor: se usa la copia local */ });
      ciclo();
    }
  });

  ciclo();
  if (usarSesion.getState().usuario) {
    refrescarCatalogo().catch(() => { /* sin servidor: se usa la copia local */ });
  }
}

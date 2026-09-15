import { enviarJson } from "../api/cliente.js";
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
  if (subiendo) return;
  subiendo = true;
  const estado = usarConexion.getState();

  try {
    const items = await cola.pendientes();
    if (items.length) estado.actualizar({ subiendo: true });

    for (const item of items) {
      if (item.proximoIntento > Date.now()) continue;
      try {
        await enviarJson(item.ruta, item.cuerpo, item.id);
        await cola.marcarSubida(item.id);
        estado.actualizar({ hayServidor: true, ultimoContacto: new Date() });
      } catch (e) {
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

  ciclo();
  refrescarCatalogo().catch(() => { /* sin servidor: se usa la copia local */ });
}

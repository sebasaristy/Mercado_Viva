import { enviar } from "../api/cliente.js";
import * as cola from "./cola.js";
import { pedirAlmacenamientoPersistente } from "./db.js";
import { estadoSync } from "./estado.js";

// El único archivo que habla con el servidor. Las pantallas escriben en Dexie y siguen.
let corriendo = false;

export async function vaciarCola() {
  if (corriendo) return;
  corriendo = true;
  estadoSync.getState().marcarSincronizando(true);

  try {
    const items = await cola.pendientes();
    for (const item of items) {
      if (item.proximoIntento > Date.now()) continue;
      try {
        await cola.marcarEnviando(item.id);
        // El servidor responde 200 si ya lo tenía y 201 si es nuevo. Los dos son éxito.
        await enviar(item.ruta, item.cuerpo, item.id);
        await cola.marcarEnviado(item.id);
      } catch (e) {
        await cola.marcarFallido(item.id, e);
        if (e.esDeRed) break;   // no hay señal: no tiene sentido seguir intentando
      }
    }
    await cola.limpiarEnviados();
  } finally {
    corriendo = false;
    estadoSync.getState().marcarSincronizando(false);
    estadoSync.getState().refrescarPendientes();
  }
}

export function arrancarSync() {
  pedirAlmacenamientoPersistente();

  // No se confía en navigator.onLine: miente. Se considera que hay red cuando
  // una petición responde, no antes. Por eso hay varios disparadores y un respaldo.
  addEventListener("online", vaciarCola);
  addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") vaciarCola();
  });
  setInterval(vaciarCola, 30000);

  navigator.serviceWorker?.ready
    .then((reg) => reg.sync?.register("vaciar-cola"))
    .catch(() => { /* el navegador no soporta Background Sync: quedan los otros disparadores */ });

  vaciarCola();
}

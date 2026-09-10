import { create } from "zustand";
import { cuantasPendientes } from "./cola.js";

// Lo que ve el usuario sobre el estado de la sincronización.
// No es decoración: si algo lleva rato sin subir, tiene que enterarse.
export const estadoSync = create((set) => ({
  pendientes: 0,
  sincronizando: false,
  ultimaSync: null,

  marcarSincronizando: (v) =>
    set({ sincronizando: v, ...(v ? {} : { ultimaSync: new Date() }) }),

  refrescarPendientes: async () => set({ pendientes: await cuantasPendientes() })
}));

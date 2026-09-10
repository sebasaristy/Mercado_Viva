import { create } from "zustand";
import { cuantasPendientes } from "./cola.js";

// Lo que ve el operario sobre el estado de la sincronización.
// hayRed no sale de navigator.onLine, que miente: se marca true cuando una
// petición realmente respondió, y false cuando una falló por red.
export const estadoSync = create((set) => ({
  pendientes: 0,
  sincronizando: false,
  hayRed: true,
  ultimaSync: null,

  marcarSincronizando: (v) =>
    set({ sincronizando: v, ...(v ? {} : { ultimaSync: new Date() }) }),

  marcarRed: (hayRed) => set({ hayRed }),

  refrescarPendientes: async () => set({ pendientes: await cuantasPendientes() })
}));

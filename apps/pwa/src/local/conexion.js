import { create } from "zustand";

// Lo que la persona necesita saber del estado de la conexión.
// hayServidor no sale de navigator.onLine, que miente: se marca cuando una
// petición al servidor realmente respondió o realmente falló.
export const usarConexion = create((set) => ({
  hayServidor: true,
  pendientes: 0,
  atascadas: [],
  subiendo: false,
  ultimoContacto: null,
  actualizar: (parcial) => set(parcial)
}));

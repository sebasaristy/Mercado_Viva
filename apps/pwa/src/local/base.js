import Dexie from "dexie";

// Base local del navegador. Se llama v2 a propósito: la primera versión guardaba
// productos de demo con ids inventados ("a1") que la API rechazaba, y así nada
// de lo que se registraba llegaba al servidor.
export const base = new Dexie("mercado-viva-v2");

base.version(1).stores({
  // Copia del catálogo que viene de la API, para escanear sin conexión.
  productos: "id, codigoBarras, nombre",
  // Lo que se registró sin conexión y espera para subir.
  cola: "id, estado, creadoEn"
});

// Sin esto el navegador puede borrar los datos cuando le falte espacio,
// y con ellos operaciones que nadie volvió a registrar.
export async function pedirAlmacenamientoPersistente() {
  try {
    if (!navigator.storage?.persist) return false;
    if (await navigator.storage.persisted()) return true;
    return await navigator.storage.persist();
  } catch {
    return false;
  }
}

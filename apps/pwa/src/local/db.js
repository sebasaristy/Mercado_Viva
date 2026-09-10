import Dexie from "dexie";

// La base local es la fuente de verdad de la pantalla. Lo que se ve sale de aquí,
// con red o sin ella. El servidor es a dónde se manda después.
export const local = new Dexie("mercado-viva");

local.version(1).stores({
  // Copia de solo lectura, para poder escanear sin red.
  productos: "id, codigoBarras, nombre, categoria",

  // La cola de salida. 'estado' está indexado porque es por donde se barre.
  cola: "id, estado, creadoEn",

  // Lo que el contador lleva en su zona, antes de cerrar la sesión.
  conteoBorrador: "[zonaId+productoId], zonaId",

  // Preferencias del dispositivo: sede, ubicación, turno.
  ajustes: "clave"
});

// Sin esto el navegador puede botar los datos cuando le falte espacio,
// y ahí se van movimientos que nadie volvió a registrar.
export async function pedirAlmacenamientoPersistente() {
  if (!navigator.storage?.persist) return false;
  if (await navigator.storage.persisted()) return true;
  return navigator.storage.persist();
}

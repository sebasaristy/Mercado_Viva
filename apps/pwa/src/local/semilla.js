import { local } from "./db.js";

// Datos para poder abrir la app y ver las pantallas sin tener la API arriba.
// Se cargan una sola vez, y solo si el catálogo local está vacío.
const DEMO = [
  { id: "a1", codigoBarras: "7702001010011", nombre: "Arroz Diana 500 g",   categoria: "abarrotes", unidad: "unidad", precio: 3200 },
  { id: "a2", codigoBarras: "7702001010028", nombre: "Arroz Roa 500 g",     categoria: "abarrotes", unidad: "unidad", precio: 3350 },
  { id: "a3", codigoBarras: "7702354001015", nombre: "Leche Alquería 1 L",  categoria: "lacteos",   unidad: "unidad", precio: 4100 },
  { id: "a4", codigoBarras: "7702354002012", nombre: "Leche Colanta 1 L",   categoria: "lacteos",   unidad: "unidad", precio: 4100 },
  { id: "a5", codigoBarras: "7701234500019", nombre: "Aceite Girasol 1 L",  categoria: "abarrotes", unidad: "unidad", precio: 12900 },
  // Los productos de balanza se guardan con su codigo INTERNO de 5 digitos,
  // no con un codigo escaneado completo: el escaneado trae el peso adentro y
  // cambia en cada pesada. Ver packages/compartido/src/codigos/balanza.js
  { id: "a6", codigoBarras: "12345",        nombre: "Banano",              categoria: "frutas",    unidad: "kg",     precio: 3800 },
  { id: "a7", codigoBarras: "7709876500013", nombre: "Huevos AA x 30",      categoria: "huevos",    unidad: "unidad", precio: 18500 },
  { id: "a8", codigoBarras: "7705566700012", nombre: "Pan tajado 500 g",    categoria: "panaderia", unidad: "unidad", precio: 6900 }
];

export async function sembrarSiHaceFalta() {
  if ((await local.productos.count()) > 0) return false;
  await local.productos.bulkAdd(DEMO);
  return true;
}

// Las unidades que NO se prometen, porque el teórico nunca es exacto.
//
// Fase actual: constante por categoría, puesta a ojo. Es suficiente para arrancar.
// Fase siguiente: reemplazar por el percentil 90 de la discrepancia observada
// (teórico menos encontrado) en las últimas recolecciones de cada producto,
// recalculado semanal por un job. Los datos salen del modo sombra.
const POR_CATEGORIA = {
  lacteos: 2,
  frutas: 3,
  verduras: 3,
  carnes: 2,
  panaderia: 2,
  abarrotes: 0,
  aseo: 0
};

export const colchonInicial = (categoria) => POR_CATEGORIA[categoria] ?? 1;

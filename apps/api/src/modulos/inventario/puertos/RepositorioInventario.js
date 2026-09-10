// El contrato que necesita el módulo para guardar y leer el libro.
//
// Se declara aquí, del lado de quien lo USA, no del lado de quien lo implementa.
// Esa es la inversión de dependencias: los casos de uso dependen de este contrato,
// y el adaptador de Postgres depende del contrato también. Ninguno depende del otro.
//
// Las interfaces se dejan chicas a propósito: el que solo lee no tiene por qué
// recibir métodos de escritura. Por eso son dos grupos y no uno con todo adentro.

/**
 * @typedef {object} PuertoLecturaInventario
 * @property {(tenantId: string, productoId: string) => Promise<{cantidad: number}>} existencia
 * @property {(tenantId: string, productoId: string, limite?: number) => Promise<object[]>} historial
 * @property {(id: string) => Promise<object|null>} porId
 */

/**
 * @typedef {object} PuertoEscrituraInventario
 * @property {(fn: (tx: object) => Promise<any>) => Promise<any>} enTransaccion
 * @property {(tx: object, movimiento: object) => Promise<boolean>} guardarMovimiento
 *           Devuelve true si el movimiento YA existía (la tablet está reintentando).
 * @property {(tx: object, tenantId: string, productoId: string, delta: number) => Promise<void>} aplicarDelta
 */

export const METODOS_LECTURA = ["existencia", "historial", "porId"];
export const METODOS_ESCRITURA = ["enTransaccion", "guardarMovimiento", "aplicarDelta"];

// Se usa en las pruebas de contrato para que ningún adaptador se quede corto.
export function verificarImplementacion(repo, nombre = "repositorio") {
  const faltantes = [...METODOS_LECTURA, ...METODOS_ESCRITURA]
    .filter((m) => typeof repo?.[m] !== "function");
  if (faltantes.length) {
    throw new Error(`${nombre} no cumple el contrato: falta ${faltantes.join(", ")}`);
  }
  return repo;
}

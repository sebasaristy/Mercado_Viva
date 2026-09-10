// El contrato que necesita el módulo para guardar y leer el libro.
//
// Se declara aquí, del lado de quien lo USA, no del lado de quien lo implementa.
// Esa es la inversión de dependencias: los casos de uso dependen de este contrato,
// y el adaptador de Supabase depende del contrato también. Ninguno depende del otro.
//
// Nota sobre la forma del contrato: `registrarMovimiento` es UN método y no
// "inserta el movimiento" + "aplica el delta" por separado, a propósito. Las dos
// escrituras tienen que ocurrir juntas o ninguna, y quién garantiza eso es asunto
// del adaptador — en Supabase, una función de Postgres; en memoria, el propio Map.
// Si el puerto expusiera los dos pasos, la atomicidad quedaría en manos de quien
// llama, que es justo donde no debe estar.

/**
 * @typedef {object} ResultadoRegistro
 * @property {boolean} yaExistia   true si la tablet está reintentando
 * @property {number}  existencia  saldo del producto después del movimiento
 * @property {object}  movimiento  el asiento tal como quedó guardado
 */

/**
 * @typedef {object} RepositorioInventario
 * @property {(movimiento: object) => Promise<ResultadoRegistro>} registrarMovimiento
 * @property {(tenantId: string, productoId: string) => Promise<{cantidad: number}>} existencia
 * @property {(tenantId: string, productoId: string, limite?: number) => Promise<object[]>} historial
 * @property {(id: string) => Promise<object|null>} porId
 */

export const METODOS = ["registrarMovimiento", "existencia", "historial", "porId"];

// Se usa en las pruebas de contrato para que ningún adaptador se quede corto.
export function verificarImplementacion(repo, nombre = "repositorio") {
  const faltantes = METODOS.filter((m) => typeof repo?.[m] !== "function");
  if (faltantes.length) {
    throw new Error(`${nombre} no cumple el contrato: falta ${faltantes.join(", ")}`);
  }
  return repo;
}

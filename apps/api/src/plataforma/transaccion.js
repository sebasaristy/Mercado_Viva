import { pool } from "./db.js";

// Regla 4 de ARQUITECTURA.md: todo lo que toca existencias va dentro de una transacción.
// El servicio abre y cierra; el repo solo recibe el cliente y ejecuta.
//
//   await enTransaccion(async (tx) => {
//     await repo.insertarMovimiento(tx, mov);
//     await repo.aplicarDelta(tx, mov);
//   });
export async function enTransaccion(fn) {
  const tx = await pool.connect();
  try {
    await tx.query("begin");
    const resultado = await fn(tx);
    await tx.query("commit");
    return resultado;
  } catch (e) {
    await tx.query("rollback");
    throw e;
  } finally {
    tx.release();
  }
}

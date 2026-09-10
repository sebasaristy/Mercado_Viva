import inventario from "../inventario/index.js";
import { enTransaccion } from "../../plataforma/transaccion.js";
import { ErrorDeNegocio } from "../../plataforma/errores.js";
import { nuevoId } from "@mv/compartido";
import * as repo from "./repo.js";

// Abrir la sesión sí necesita conexión: aquí se congela el teórico contra el cual
// se va a comparar. Después de esto, cada contador puede trabajar sin red.
export const abrirSesion = (usuario, datos) =>
  enTransaccion((tx) => repo.crearSesion(tx, usuario, datos.sede));

// El unique (sesion_id, ubicacion_id) de la migración hace el trabajo pesado:
// si la zona ya está asignada, la base lo rechaza. Aquí solo traducimos el error.
export async function asignarZona(usuario, sesionId, datos) {
  try {
    return await repo.asignarZona(sesionId, datos.ubicacionId, datos.usuarioId);
  } catch (e) {
    if (e.code === "23505") {
      throw new ErrorDeNegocio(
        "Esa zona ya está asignada a otro contador en esta sesión.",
        "zona_ocupada"
      );
    }
    throw e;
  }
}

// Conteo ciego: no se le devuelve al contador el teórico. Lo que escribe es lo que ve.
export const registrarLinea = (usuario, linea) => repo.guardarLinea(usuario, linea);

// El ajuste no es "contado menos teórico de hoy": es contado menos el teórico
// congelado al abrir, más lo que se movió mientras se contaba.
export async function cerrarSesion(usuario, sesionId) {
  const lineas = await repo.lineasDeSesion(sesionId);
  const ajustes = [];

  for (const l of lineas) {
    const movidoDurante = await repo.movidoDurante(usuario.tenantId, l.producto_id, sesionId);
    const esperado = Number(l.snapshot_teorico) + Number(movidoDurante);
    const diferencia = Number(l.cantidad_contada) - esperado;
    if (diferencia === 0) continue;

    await inventario.registrarMovimiento(usuario, {
      id: nuevoId(),
      productoId: l.producto_id,
      tipo: "AJUSTE",
      cantidad: Math.abs(diferencia),
      motivo: diferencia > 0 ? "conteo: sobrante" : "conteo: faltante",
      referencia: sesionId,
      creadoEn: new Date()
    });
    ajustes.push({ productoId: l.producto_id, diferencia });
  }

  await repo.cerrar(sesionId);
  return { sesionId, ajustes: ajustes.length, detalle: ajustes };
}

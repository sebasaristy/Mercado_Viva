import { leerCodigoBalanza } from "@mv/compartido";
import { ErrorNoEncontrado } from "../../plataforma/errores.js";
import * as repo from "./repo.js";

// Un código de balanza no identifica un producto por sí solo: trae peso o precio
// adentro. Se separa aquí, no en la pantalla, para que valga igual desde cualquier cliente.
export async function buscarPorCodigo(tenantId, codigo) {
  const leido = leerCodigoBalanza(codigo);
  const producto = await repo.porCodigo(tenantId, leido.codigoProducto ?? codigo);
  if (!producto) throw new ErrorNoEncontrado(`producto con código ${codigo}`);
  return { producto, pesoKg: leido.pesoKg ?? null, precioLeido: leido.precio ?? null };
}

export async function obtener(tenantId, id) {
  const producto = await repo.porId(tenantId, id);
  if (!producto) throw new ErrorNoEncontrado(`producto ${id}`);
  return producto;
}

export const equivalentesDe = (tenantId, productoId) =>
  repo.equivalentes(tenantId, productoId);

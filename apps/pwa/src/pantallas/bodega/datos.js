import { leerCodigoBalanza } from "@mv/compartido";
import { local } from "../../local/db.js";

// Se busca contra la copia local para que el escaneo no dependa de la red.
export async function buscarProductoLocal(codigo) {
  const leido = leerCodigoBalanza(codigo);
  const buscado = leido.codigoProducto ?? codigo;
  const producto = await local.productos.where("codigoBarras").equals(buscado).first();
  if (!producto) return null;
  return { ...producto, pesoKg: leido.pesoKg ?? null };
}

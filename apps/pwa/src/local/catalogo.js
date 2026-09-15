import { leerCodigoBalanza } from "@mv/compartido";
import { obtenerJson } from "../api/cliente.js";
import { base } from "./base.js";

// Trae el catálogo real de la API y lo deja guardado en el equipo,
// para poder escanear y vender aunque se caiga la conexión.
export async function refrescarCatalogo() {
  const lista = await obtenerJson("/catalogo/productos");
  await base.transaction("rw", base.productos, async () => {
    await base.productos.clear();
    await base.productos.bulkPut(lista);
  });
  return lista;
}

export const productosEnCache = () => base.productos.orderBy("nombre").toArray();

export const guardarEnCache = (producto) => base.productos.put(producto);

export async function buscarEnCache(codigoEscaneado) {
  const leido = leerCodigoBalanza(String(codigoEscaneado).trim());
  const interno = leido.codigoProducto ?? codigoEscaneado;
  const producto = await base.productos.where("codigoBarras").equals(interno).first();
  return { producto: producto ?? null, codigo: interno, pesoKg: leido.pesoKg ?? null };
}

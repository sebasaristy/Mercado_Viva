import { nuevoId } from "@mv/compartido";
import { enviarJson, obtenerJson } from "../api/cliente.js";
import { encolar } from "./cola.js";
import { buscarEnCache, guardarEnCache } from "./catalogo.js";
import { usarConexion } from "./conexion.js";

// Toda escritura pasa por aquí.
//
// Primero intenta en línea, para mostrar el resultado real ("ahora hay 32").
// Si no hay red, la guarda en la cola con el mismo id y la sube después; como
// el servidor usa ese id para no repetir, subirla dos veces no la duplica.
// Si el servidor respondió que no (datos inválidos, código repetido), NO se
// encola: reintentar no lo arregla, así que se le muestra el mensaje a la persona.
export async function ejecutar(ruta, cuerpo) {
  const id = nuevoId();
  const completo = { ...cuerpo, id, creadoEn: new Date().toISOString() };

  try {
    const datos = await enviarJson(ruta, completo, id);
    usarConexion.getState().actualizar({ hayServidor: true, ultimoContacto: new Date() });
    return { enLinea: true, datos, id };
  } catch (e) {
    if (!e.deRed) throw e;
    await encolar(ruta, completo);
    const estado = usarConexion.getState();
    estado.actualizar({ hayServidor: false, pendientes: estado.pendientes + 1 });
    return { enLinea: false, datos: null, id };
  }
}

// Busca un producto por código: en línea si se puede, en la copia local si no.
export async function buscarProducto(codigo) {
  try {
    const r = await obtenerJson(`/catalogo/productos/codigo/${encodeURIComponent(codigo)}`);
    guardarEnCache(r.producto);
    return { producto: r.producto, pesoKg: r.pesoKg, codigo, enLinea: true };
  } catch (e) {
    if (e.codigo === "producto_no_registrado") {
      return {
        producto: null,
        codigo: e.detalle?.codigo ?? codigo,
        pesoKg: e.detalle?.pesoKg ?? null,
        enLinea: true
      };
    }
    if (!e.deRed) throw e;
    usarConexion.getState().actualizar({ hayServidor: false });
    return { ...(await buscarEnCache(codigo)), enLinea: false };
  }
}

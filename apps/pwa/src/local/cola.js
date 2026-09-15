import { base } from "./base.js";
import { usarSesion } from "../api/sesion.js";

// Estados: pendiente -> (subida: se borra)
//          pendiente -> fallido  (sin red: se reintenta con espera creciente)
//          pendiente -> atascado (el servidor la rechazó o se agotaron los intentos:
//                                 reintentar no la arregla, la tiene que ver alguien)
const MAX_INTENTOS = 8;

// El id viene en el cuerpo y es el mismo con el que se intentó en línea.
// Por eso subirla después no puede duplicarla.
//
// Se guarda quién la hizo: si en el mismo celular entra otra persona antes de
// que vuelva la señal, esa venta no se sube a nombre de quien no la hizo.
export async function encolar(ruta, cuerpo) {
  await base.cola.put({
    id: cuerpo.id,
    ruta,
    cuerpo,
    usuarioId: usarSesion.getState().usuario?.id ?? null,
    estado: "pendiente",
    intentos: 0,
    proximoIntento: 0,
    creadoEn: Date.now(),
    ultimoError: null
  });
}

// En el orden en que ocurrieron: crear un producto tiene que subir antes que
// la venta de ese producto.
export async function pendientes() {
  const items = await base.cola.where("estado").anyOf("pendiente", "fallido").toArray();
  return items.sort((a, b) => a.creadoEn - b.creadoEn);
}

export const contarPendientes = () =>
  base.cola.where("estado").anyOf("pendiente", "fallido").count();

export const atascadas = () => base.cola.where("estado").equals("atascado").toArray();

export const marcarSubida = (id) => base.cola.delete(id);

export async function marcarFallida(id, error, sePuedeReintentar) {
  const item = await base.cola.get(id);
  if (!item) return;
  const intentos = item.intentos + 1;
  // Espera creciente: 2 s, 4 s, 8 s... con techo de 5 minutos.
  const espera = Math.min(2 ** intentos * 1000, 5 * 60 * 1000);
  await base.cola.update(id, {
    estado: !sePuedeReintentar || intentos >= MAX_INTENTOS ? "atascado" : "fallido",
    intentos,
    proximoIntento: Date.now() + espera,
    ultimoError: String(error?.message ?? error)
  });
}

export const descartar = (id) => base.cola.delete(id);

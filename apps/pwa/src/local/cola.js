import { nuevoId } from "@mv/compartido";
import { local } from "./db.js";

// Estados: pendiente -> enviando -> enviado
//                    \-> fallido (se reintenta con espera creciente)
//                    \-> atascado (agotó los intentos: lo tiene que ver una persona)
const MAX_INTENTOS = 8;

// El id se crea AQUÍ, en el momento en que ocurre la operación.
// No cuando se envía. Es lo que hace que reintentar no duplique.
export async function encolar(tipo, ruta, cuerpo) {
  const id = nuevoId();
  await local.cola.add({
    id, tipo, ruta,
    cuerpo: { ...cuerpo, id, creadoEn: new Date().toISOString() },
    estado: "pendiente",
    intentos: 0,
    proximoIntento: 0,
    creadoEn: Date.now(),
    ultimoError: null
  });
  return id;
}

export const pendientes = () =>
  local.cola.where("estado").anyOf("pendiente", "fallido").toArray();

export const cuantasPendientes = () =>
  local.cola.where("estado").anyOf("pendiente", "fallido", "atascado").count();

export const marcarEnviando = (id) => local.cola.update(id, { estado: "enviando" });

export const marcarEnviado = (id) =>
  local.cola.update(id, { estado: "enviado", ultimoError: null });

export async function marcarFallido(id, error) {
  const item = await local.cola.get(id);
  const intentos = (item?.intentos ?? 0) + 1;
  // Espera creciente: 2s, 4s, 8s... con techo de 5 minutos.
  const espera = Math.min(2 ** intentos * 1000, 5 * 60 * 1000);
  await local.cola.update(id, {
    estado: intentos >= MAX_INTENTOS ? "atascado" : "fallido",
    intentos,
    proximoIntento: Date.now() + espera,
    ultimoError: String(error?.message ?? error)
  });
}

// Se guardan un rato por si hay que revisar algo, no para siempre.
export const limpiarEnviados = () =>
  local.cola.where("estado").equals("enviado")
    .and((i) => Date.now() - i.creadoEn > 86400000)
    .delete();

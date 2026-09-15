import { scrypt, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import { promisify } from "node:util";

// Contraseñas y tokens. Solo node:crypto, sin dependencias.
//
// scrypt es lento a propósito y gasta memoria: probar millones de contraseñas
// contra una huella robada deja de ser barato. Los parámetros van dentro de la
// huella, así que se pueden subir más adelante sin romper las que ya existen.
const derivar = promisify(scrypt);

const N = 16384;
const R = 8;
const P = 1;
const LARGO = 32;

const preparar = (clave) => String(clave).normalize("NFKC");

export async function cifrarClave(clave) {
  const sal = randomBytes(16);
  const huella = await derivar(preparar(clave), sal, LARGO, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${sal.toString("base64url")}$${huella.toString("base64url")}`;
}

export async function verificarClave(clave, guardada) {
  const partes = String(guardada ?? "").split("$");
  if (partes.length !== 6 || partes[0] !== "scrypt") return false;
  const [, n, r, p, sal, huella] = partes;
  const esperada = Buffer.from(huella, "base64url");
  const calculada = await derivar(preparar(clave), Buffer.from(sal, "base64url"), esperada.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024
  });
  return calculada.length === esperada.length && timingSafeEqual(calculada, esperada);
}

// Si la cédula no existe se gasta el mismo tiempo que si existiera. Sin esto,
// medir cuánto tarda la respuesta dice qué cédulas tienen cuenta.
const HUELLA_DE_RELLENO = await cifrarClave(randomBytes(16).toString("hex"));
export async function verificarContraNada(clave) {
  await verificarClave(clave, HUELLA_DE_RELLENO);
  return false;
}

// Token de sesión: 256 bits al azar. En la base solo se guarda su sha256.
export const tokenAleatorio = () => randomBytes(32).toString("base64url");
export const huellaDeToken = (token) => createHash("sha256").update(String(token)).digest("base64url");

// Código para dictar o copiar: sin 0/O ni 1/I/L, que se confunden.
const LEGIBLES = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function codigoLegible() {
  const letras = Array.from(randomBytes(8), (b) => LEGIBLES[b % LEGIBLES.length]).join("");
  return `${letras.slice(0, 4)}-${letras.slice(4)}`;
}

export function igualesSinFiltrarTiempo(a, b) {
  const x = createHash("sha256").update(String(a)).digest();
  const y = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(x, y);
}

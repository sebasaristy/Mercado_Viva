// Cómo se ven los números en toda la app. Un solo lugar para que "$ 3.200"
// no aparezca escrito de tres formas distintas.
const moneda = new Intl.NumberFormat("es-CO", {
  style: "currency", currency: "COP", maximumFractionDigits: 0
});
const numero = new Intl.NumberFormat("es-CO", { maximumFractionDigits: 2 });

export const pesos = (n) => moneda.format(Math.round(Number(n) || 0));
export const num = (n) => numero.format(Number(n) || 0);

// "12 unidades", "1 unidad", "0,85 kg"
export const conUnidad = (n, unidad) =>
  unidad === "kg" ? `${num(n)} kg` : `${num(n)} ${Number(n) === 1 ? "unidad" : "unidades"}`;

// Versión corta para columnas: "12 und", "0,85 kg"
export const corta = (n, unidad) => (unidad === "kg" ? `${num(n)} kg` : `${num(n)} und`);

export const hora = (fecha) =>
  new Date(fecha).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });

export function margen(precio, costo) {
  const p = Number(precio) || 0;
  const c = Number(costo) || 0;
  if (p <= 0) return null;
  return { valor: p - c, pct: Math.round(((p - c) / p) * 1000) / 10 };
}

export function haceCuanto(fecha) {
  if (!fecha) return "";
  const s = Math.max(0, Math.round((Date.now() - new Date(fecha)) / 1000));
  if (s < 10) return "justo ahora";
  if (s < 60) return `hace ${s} s`;
  return `hace ${Math.round(s / 60)} min`;
}

// Para ejes de gráficos, donde no cabe "$ 1.250.000": "$ 1,3 M", "$ 180 mil".
const compacto = new Intl.NumberFormat("es-CO", { notation: "compact", maximumFractionDigits: 1 });
export const pesosCorto = (n) => `$ ${compacto.format(Math.round(Number(n) || 0))}`;

// Para campos de dinero en pesos colombianos: sin centavos, sin puntos.
export const soloDigitos = (v) => String(v).replace(/[^\d]/g, "");

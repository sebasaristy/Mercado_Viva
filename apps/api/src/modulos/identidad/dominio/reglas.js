// Reglas de identidad que no dependen de dónde se guarden los usuarios.

export const ROLES = ["administrador", "cajero", "bodega"];

// La gente escribe la cédula como la tiene en la cabeza: "1.023.456.789".
export const normalizarCedula = (valor) => String(valor ?? "").replace(/[\s.-]/g, "");

const DEMASIADO_COMUNES = new Set([
  "12345678", "123456789", "1234567890", "87654321", "11111111", "00000000",
  "password", "contraseña", "contrasena", "qwertyui", "abcdefgh", "abc12345",
  "mercadoviva", "mercado123", "colombia", "administrador"
]);

// null si sirve; si no, la frase que se le muestra a la persona.
//
// Largo mínimo y nada obvio. No se exigen mayúsculas ni símbolos: eso produce
// "Mercado1!" escrito en un papel pegado a la caja, que es peor.
export function problemaConLaClave(clave, { cedula } = {}) {
  const c = String(clave ?? "");
  if (c.length < 8) return "La contraseña tiene que tener al menos 8 caracteres.";
  if (c.length > 128) return "La contraseña es demasiado larga (máximo 128 caracteres).";
  if (cedula && c.includes(cedula)) return "La contraseña no puede contener la cédula.";
  if (/^(.)\1+$/.test(c) || DEMASIADO_COMUNES.has(c.toLowerCase())) {
    return "Esa contraseña es muy fácil de adivinar. Usa otra.";
  }
  return null;
}

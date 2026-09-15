import { config } from "./config.js";
import { verificarAcceso } from "./tokens.js";
import { ErrorNoAutorizado, ErrorProhibido } from "./errores.js";

// Quién es y qué puede hacer.
//
// El token lo emite el módulo identidad y lo firma esta misma API. Aquí solo
// se verifica, sin ir a la base: por eso vence a los 10 minutos.

const USUARIO_DE_DESARROLLO = {
  id: "00000000-0000-0000-0000-0000000000de",
  rol: "administrador",
  nombre: "Desarrollo",
  tenantId: config.tenantPorDefecto,
  sesionId: null,
  debeCambiarClave: false
};

function crearGuardia({ aunqueDebaCambiarClave = false } = {}) {
  return async function guardia(req, _res, siguiente) {
    // Atajo para probar endpoints con curl. config.js lo impide en producción.
    if (config.authDesactivada) {
      req.usuario = USUARIO_DE_DESARROLLO;
      return siguiente();
    }

    const encabezado = req.get("authorization") ?? "";
    const token = encabezado.startsWith("Bearer ") ? encabezado.slice(7).trim() : null;
    if (!token) return siguiente(new ErrorNoAutorizado());

    try {
      req.usuario = await verificarAcceso(token);
    } catch {
      return siguiente(new ErrorNoAutorizado());
    }

    // Con una contraseña que puso el administrador solo se puede hacer una cosa:
    // cambiarla.
    if (req.usuario.debeCambiarClave && !aunqueDebaCambiarClave) {
      return siguiente(new ErrorProhibido("Primero cambia tu contraseña.", "debe_cambiar_clave"));
    }
    siguiente();
  };
}

export const requiereSesion = crearGuardia();
export const requiereSesionAunqueDebaCambiarClave = crearGuardia({ aunqueDebaCambiarClave: true });

// Solo estos roles.
export const permitir = (...roles) => (req, _res, siguiente) =>
  roles.includes(req.usuario?.rol) ? siguiente() : siguiente(new ErrorProhibido());

// Leer lo puede cualquiera con sesión; cambiar algo, solo estos roles.
export const soloEscriben = (...roles) => (req, res, siguiente) =>
  req.method === "GET" || req.method === "HEAD"
    ? siguiente()
    : permitir(...roles)(req, res, siguiente);

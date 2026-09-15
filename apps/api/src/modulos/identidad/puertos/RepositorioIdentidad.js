// Lo que el módulo necesita de quien guarde usuarios y sesiones.
// Cualquier adaptador (Supabase, memoria) tiene que cumplir esta lista.
const METODOS = [
  "hayUsuarios",          // (tenantId) -> boolean
  "buscarParaIngresar",   // (tenantId, { cedula } | { id }) -> usuario con claveHash | null
  "registrarIngreso",     // (usuarioId, exito) -> { bloqueadoHasta, restantes }
  "crearSesion",          // ({ id, usuarioId, tokenHash, expiraEn, agente })
  "rotarSesion",          // ({ tokenHash, nuevoId, nuevoHash, expiraEn }) -> { ok, error, usuario }
  "cerrarSesion",         // (tokenHash)
  "listarUsuarios",       // (tenantId) -> usuario[]
  "crearUsuario",         // ({ id, tenantId, cedula, nombre, rol, claveHash, debeCambiarClave })
  "actualizarUsuario",    // ({ tenantId, id, actorId, nombre?, rol?, activo?, claveHash? })
  "cambiarClave"          // ({ usuarioId, claveHash, sesionId })
];

export function verificarRepositorioIdentidad(repositorio) {
  const faltan = METODOS.filter((m) => typeof repositorio?.[m] !== "function");
  if (faltan.length) {
    throw new Error(`El repositorio de identidad no implementa: ${faltan.join(", ")}`);
  }
}

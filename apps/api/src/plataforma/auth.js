import { createRemoteJWKSet, jwtVerify } from "jose";
import { config } from "./config.js";
import { ErrorNoAutorizado } from "./errores.js";

const jwks = config.supabase.url
  ? createRemoteJWKSet(new URL(`${config.supabase.url}/auth/v1/.well-known/jwks.json`))
  : null;

// Supabase emite el token; nosotros solo lo verificamos.
// La PWA nunca toca la base directo: siempre pasa por aquí.
export async function requiereSesion(req, _res, siguiente) {
  // Atajo de desarrollo, para poder probar endpoints sin montar el login todavía.
  // config.js impide que esto quede encendido fuera de desarrollo.
  if (config.authDesactivada) {
    req.usuario = {
      id: "00000000-0000-0000-0000-0000000000de",
      rol: "desarrollo",
      tenantId: config.tenantPorDefecto
    };
    return siguiente();
  }

  try {
    const encabezado = req.get("authorization") ?? "";
    const token = encabezado.startsWith("Bearer ") ? encabezado.slice(7) : null;
    if (!token || !jwks) throw new Error("sin token");

    const { payload } = await jwtVerify(token, jwks);
    req.usuario = {
      id: payload.sub,
      rol: payload.rol ?? "operario",
      tenantId: payload.tenant_id ?? config.tenantPorDefecto
    };
    siguiente();
  } catch {
    siguiente(new ErrorNoAutorizado());
  }
}

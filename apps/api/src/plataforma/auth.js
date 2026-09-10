import { createRemoteJWKSet, jwtVerify } from "jose";
import { ErrorNoAutorizado } from "./errores.js";

const jwks = createRemoteJWKSet(
  new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`)
);

// Supabase emite el token; nosotros solo lo verificamos. La PWA nunca toca la base directo.
export async function requiereSesion(req, _res, siguiente) {
  try {
    const encabezado = req.get("authorization") || "";
    const token = encabezado.startsWith("Bearer ") ? encabezado.slice(7) : null;
    if (!token) throw new Error("sin token");

    const { payload } = await jwtVerify(token, jwks);
    req.usuario = {
      id: payload.sub,
      rol: payload.rol ?? "operario",
      tenantId: payload.tenant_id ?? process.env.TENANT_ID
    };
    siguiente();
  } catch {
    siguiente(new ErrorNoAutorizado());
  }
}

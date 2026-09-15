import { SignJWT, jwtVerify } from "jose";
import { config } from "./config.js";

// Token de acceso: corto (10 minutos) y firmado por esta API.
//
// Viaja en cada petición y la API lo verifica sin ir a la base, por eso vence
// rápido: si a alguien lo desactivan, en minutos deja de servirle. Lo que dura
// semanas es el token de sesión, que vive en una cookie que JavaScript no puede
// leer y que la base puede revocar en cualquier momento.
const secreto = new TextEncoder().encode(config.sesion.secreto);
const EMISOR = "mercado-viva";
const AUDIENCIA = "mercado-viva-api";

export async function firmarAcceso(usuario, sesionId) {
  return new SignJWT({
    rol: usuario.rol,
    tid: usuario.tenantId,
    nom: usuario.nombre,
    sid: sesionId,
    ...(usuario.debeCambiarClave ? { dcc: true } : {})
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(usuario.id)
    .setIssuer(EMISOR)
    .setAudience(AUDIENCIA)
    .setIssuedAt()
    .setExpirationTime(`${config.sesion.segundosAcceso}s`)
    .sign(secreto);
}

export async function verificarAcceso(token) {
  const { payload } = await jwtVerify(token, secreto, {
    issuer: EMISOR,
    audience: AUDIENCIA,
    algorithms: ["HS256"]
  });
  return {
    id: payload.sub,
    rol: payload.rol,
    tenantId: payload.tid,
    nombre: payload.nom,
    sesionId: payload.sid ?? null,
    debeCambiarClave: payload.dcc === true
  };
}

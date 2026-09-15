// Lee una cookie de la petición. Express escribe cookies (res.cookie) pero no
// las lee sin otra dependencia, y para una sola cookie no vale la pena.
export function leerCookie(req, nombre) {
  for (const parte of (req.get("cookie") ?? "").split(";")) {
    const igual = parte.indexOf("=");
    if (igual < 0) continue;
    if (parte.slice(0, igual).trim() !== nombre) continue;
    try {
      return decodeURIComponent(parte.slice(igual + 1).trim());
    } catch {
      return null;
    }
  }
  return null;
}

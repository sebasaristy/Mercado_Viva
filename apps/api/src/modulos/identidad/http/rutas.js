import { Router } from "express";
import { esUuid } from "@mv/compartido";
import { config } from "../../../plataforma/config.js";
import { ErrorDeNegocio, ErrorDeEntrada } from "../../../plataforma/errores.js";
import {
  requiereSesion, requiereSesionAunqueDebaCambiarClave, permitir
} from "../../../plataforma/auth.js";
import { limitarIntentos } from "../../../plataforma/limite.js";
import { leerCookie } from "../../../plataforma/cookies.js";
import { ErrorIdentidad } from "../dominio/errores.js";
import * as E from "./esquemas.js";

function traducir(e) {
  if (!(e instanceof ErrorIdentidad)) return e;
  const http = new ErrorDeNegocio(e.message, e.codigo, e.estado, e.detalle);
  http.campo = e.campo;
  return http;
}

const envolver = (manejador) => async (req, res, siguiente) => {
  try {
    await manejador(req, res);
  } catch (e) {
    siguiente(traducir(e));
  }
};

// Lo que usa la cookie de sesión solo acepta JSON. Una página ajena puede
// hacer que el navegador mande un formulario con la cookie, pero no con este
// tipo de contenido sin preguntarle antes a esta API, y la API no lo permite.
const soloJson = (req, _res, siguiente) =>
  req.is("application/json") ? siguiente() : siguiente(new ErrorDeEntrada("Se esperaba JSON."));

export function crearRutas(identidad) {
  const rutas = Router();
  const { nombreCookie, rutaCookie, segundosAcceso } = config.sesion;

  // Nada de lo que responde este módulo se guarda en caché, ni en el navegador
  // ni en un proxy.
  rutas.use((_req, res, siguiente) => {
    res.set("Cache-Control", "no-store");
    siguiente();
  });

  // httpOnly: JavaScript no la puede leer, así que un script inyectado no se la lleva.
  // secure: solo viaja por https (en el computador de desarrollo se permite http).
  // sameSite strict: no viaja en peticiones que empiezan en otra página.
  const opcionesCookie = (req) => ({
    httpOnly: true,
    secure: req.secure || !config.esDesarrollo,
    sameSite: "strict",
    path: rutaCookie
  });

  function entregarSesion(req, res, s, estado = 200) {
    res.cookie(nombreCookie, s.tokenSesion, { ...opcionesCookie(req), expires: s.expiraEn });
    // El token de sesión NUNCA va en el cuerpo: solo en la cookie.
    res.status(estado).json({ usuario: s.usuario, acceso: s.acceso, segundosAcceso });
  }

  const agente = (req) => req.get("user-agent") ?? null;

  const porEquipo = limitarIntentos({
    ventanaMs: 15 * 60_000,
    maximo: 30,
    mensaje: "Demasiados intentos desde este equipo. Espera unos minutos."
  });

  rutas.get("/estado", envolver(async (_req, res) => {
    res.json({ necesitaConfiguracion: Boolean(await identidad.prepararInstalacion()) });
  }));

  rutas.post("/primer-administrador", soloJson, porEquipo, envolver(async (req, res) => {
    const datos = E.PrimerAdministrador.parse(req.body);
    entregarSesion(req, res, await identidad.primerAdministrador({ ...datos, agente: agente(req) }), 201);
  }));

  rutas.post("/ingresar", soloJson, porEquipo, envolver(async (req, res) => {
    const datos = E.Ingreso.parse(req.body);
    entregarSesion(req, res, await identidad.ingresar({ ...datos, agente: agente(req) }));
  }));

  rutas.post("/renovar", soloJson, envolver(async (req, res) => {
    try {
      const s = await identidad.renovar({ tokenSesion: leerCookie(req, nombreCookie) });
      entregarSesion(req, res, s);
    } catch (e) {
      if (e.estado === 401) res.clearCookie(nombreCookie, opcionesCookie(req));
      throw e;
    }
  }));

  rutas.post("/salir", soloJson, envolver(async (req, res) => {
    await identidad.salir({ tokenSesion: leerCookie(req, nombreCookie) });
    res.clearCookie(nombreCookie, opcionesCookie(req));
    res.status(204).end();
  }));

  rutas.post("/clave", requiereSesionAunqueDebaCambiarClave, soloJson, envolver(async (req, res) => {
    const r = await identidad.cambiarClave(req.usuario, E.CambioDeClave.parse(req.body));
    res.json({ ...r, segundosAcceso });
  }));

  const soloAdministrador = [requiereSesion, permitir("administrador")];

  rutas.get("/usuarios", ...soloAdministrador, envolver(async (req, res) => {
    res.json(await identidad.listarUsuarios(req.usuario));
  }));

  rutas.post("/usuarios", ...soloAdministrador, soloJson, envolver(async (req, res) => {
    res.status(201).json(await identidad.crearUsuario(req.usuario, E.UsuarioNuevo.parse(req.body)));
  }));

  rutas.patch("/usuarios/:id", ...soloAdministrador, soloJson, envolver(async (req, res) => {
    if (!esUuid(req.params.id)) {
      throw new ErrorIdentidad("Ese usuario no existe.", "usuario_no_encontrado", 404);
    }
    res.json(await identidad.actualizarUsuario(
      req.usuario, req.params.id, E.CambiosDeUsuario.parse(req.body)
    ));
  }));

  return rutas;
}

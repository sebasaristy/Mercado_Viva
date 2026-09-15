// La puerta del módulo. También el único lugar que sabe qué adaptador se usa.
import { config } from "../../plataforma/config.js";
import * as claves from "../../plataforma/claves.js";
import * as tokens from "../../plataforma/tokens.js";
import { crearIdentidad } from "./fabrica.js";
import { crearRepositorioSupabase } from "./adaptadores/RepositorioSupabase.js";
import { crearRutas } from "./http/rutas.js";

const identidad = crearIdentidad({
  repositorio: crearRepositorioSupabase(),
  claves,
  tokens,
  tenantId: config.tenantPorDefecto,
  diasSesion: config.sesion.diasSesion
});

export default {
  rutas: crearRutas(identidad),
  // El servidor lo usa al arrancar para imprimir el código de instalación.
  prepararInstalacion: identidad.prepararInstalacion
};

import { config } from "../../plataforma/config.js";
import { crearVerResumen } from "./casos-uso/VerResumen.js";
import { crearRepositorioSupabase } from "./adaptadores/RepositorioSupabase.js";
import { crearRutas } from "./http/rutas.js";

const tablero = {
  verResumen: crearVerResumen({
    repositorio: crearRepositorioSupabase(),
    zona: config.zonaHoraria
  })
};

export default {
  rutas: crearRutas(tablero),
  verResumen: tablero.verResumen
};

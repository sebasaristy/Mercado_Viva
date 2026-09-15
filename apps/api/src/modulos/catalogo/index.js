// La puerta del módulo. Lo que no esté aquí, no existe para los demás.
import { rutas, rutasRapidas } from "./rutas.js";
import { buscarPorCodigo, obtener, listar, crear, equivalentesDe } from "./servicio.js";

export default { rutas, rutasRapidas, buscarPorCodigo, obtener, listar, crear, equivalentesDe };

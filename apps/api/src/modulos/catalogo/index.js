// La puerta del módulo. Lo que no esté aquí, no existe para los demás.
import { rutas } from "./rutas.js";
import { buscarPorCodigo, obtener, equivalentesDe } from "./servicio.js";

export default { rutas, buscarPorCodigo, obtener, equivalentesDe };

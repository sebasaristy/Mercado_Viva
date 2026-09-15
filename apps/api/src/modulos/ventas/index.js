// La puerta del módulo. También el único lugar que sabe qué adaptador se usa.
import { crearVentas } from "./fabrica.js";
import { crearRepositorioSupabase } from "./adaptadores/RepositorioSupabase.js";
import { crearRutas } from "./http/rutas.js";

const ventas = crearVentas({ repositorio: crearRepositorioSupabase() });

export default {
  rutas: crearRutas(ventas),
  registrarVenta: ventas.registrarVenta
};

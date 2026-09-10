// La puerta del módulo. Lo que no esté aquí, no existe para los demás.
//
// Este archivo es también el único que sabe qué implementación concreta se usa
// en producción: importa el adaptador de Postgres y se lo pasa a la fábrica.
// Nada de adentro del módulo depende de esa decisión.
import catalogo from "../catalogo/index.js";
import { crearInventario } from "./fabrica.js";
import { crearRepositorioPostgres } from "./adaptadores/RepositorioPostgres.js";
import { crearRutas } from "./http/rutas.js";

// El catálogo expone más cosas de las que inventario necesita. Aquí se recorta
// a lo que dice el puerto: así inventario no puede empezar a usar, sin querer,
// funciones del catálogo que no pactó.
const puertoCatalogo = {
  obtenerProducto: (tenantId, productoId) => catalogo.obtener(tenantId, productoId)
};

const inventario = crearInventario({
  repositorio: crearRepositorioPostgres(),
  catalogo: puertoCatalogo
});

export default {
  rutas: crearRutas(inventario),
  registrarMovimiento: inventario.registrarMovimiento,
  consultarExistencia: inventario.consultarExistencia,
  verHistorial: inventario.verHistorial
};

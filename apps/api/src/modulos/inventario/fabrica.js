import { verificarImplementacion } from "./puertos/RepositorioInventario.js";
import { verificarCatalogo } from "./puertos/PuertoCatalogo.js";
import { crearRegistrarMovimiento } from "./casos-uso/RegistrarMovimiento.js";
import { crearConsultarExistencia, crearVerHistorial } from "./casos-uso/ConsultarInventario.js";

// El único lugar del módulo donde se decide QUÉ implementación concreta se usa.
// Todo lo demás trabaja contra los puertos.
//
// En producción se llama con el repositorio de Postgres; en las pruebas, con el
// de memoria. El código que corre es exactamente el mismo.
export function crearInventario({ repositorio, catalogo }) {
  verificarImplementacion(repositorio, "repositorio de inventario");
  verificarCatalogo(catalogo);

  return {
    registrarMovimiento: crearRegistrarMovimiento({ repositorio, catalogo }),
    consultarExistencia: crearConsultarExistencia({ repositorio }),
    verHistorial: crearVerHistorial({ repositorio })
  };
}

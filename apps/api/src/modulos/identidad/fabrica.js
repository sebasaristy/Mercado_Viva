import { verificarRepositorioIdentidad } from "./puertos/RepositorioIdentidad.js";
import { crearSesiones } from "./casos-uso/sesiones.js";
import { crearInstalacion } from "./casos-uso/instalacion.js";
import { crearGestionDeUsuarios } from "./casos-uso/usuarios.js";

// Único lugar del módulo donde se arman las piezas.
// claves y tokens llegan de afuera: en las pruebas se pueden cambiar.
export function crearIdentidad({ repositorio, claves, tokens, tenantId, diasSesion }) {
  verificarRepositorioIdentidad(repositorio);

  const sesiones = crearSesiones({ repositorio, claves, tokens, tenantId, diasSesion });
  const instalacion = crearInstalacion({ repositorio, claves, tenantId });
  const usuarios = crearGestionDeUsuarios({ repositorio, claves, sesiones, instalacion, tenantId });

  return {
    ingresar: sesiones.ingresar,
    renovar: sesiones.renovar,
    salir: sesiones.salir,
    cambiarClave: sesiones.cambiarClave,
    prepararInstalacion: instalacion.preparar,
    ...usuarios
  };
}

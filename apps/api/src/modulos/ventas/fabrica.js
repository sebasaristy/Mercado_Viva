import { verificarRepositorioVentas } from "./puertos/RepositorioVentas.js";
import { crearRegistrarVenta } from "./casos-uso/RegistrarVenta.js";

// Único lugar del módulo donde se decide qué implementación concreta se usa.
export function crearVentas({ repositorio }) {
  verificarRepositorioVentas(repositorio);
  return {
    registrarVenta: crearRegistrarVenta({ repositorio })
  };
}

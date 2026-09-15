// Errores del dominio de ventas. No saben qué es un código HTTP: eso lo traduce
// la capa de rutas.
export class ReglaViolada extends Error {
  constructor(mensaje, codigo, detalle = null) {
    super(mensaje);
    this.name = "ReglaViolada";
    this.codigo = codigo;
    this.detalle = detalle;
  }
}

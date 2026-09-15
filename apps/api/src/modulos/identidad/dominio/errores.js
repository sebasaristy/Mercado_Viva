// Un "no" de identidad, con lo que HTTP necesita para responderlo.
// campo: qué casilla del formulario hay que corregir, si aplica.
export class ErrorIdentidad extends Error {
  constructor(mensaje, codigo, estado, { detalle = null, campo = null } = {}) {
    super(mensaje);
    this.name = "ErrorIdentidad";
    Object.assign(this, { codigo, estado, detalle, campo });
  }
}

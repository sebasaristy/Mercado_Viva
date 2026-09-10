// Errores del dominio. No saben qué es un código HTTP: eso lo traduce la capa de rutas.
// Si mañana esto se llama desde una cola o desde un script, los errores siguen sirviendo.
export class ReglaViolada extends Error {
  constructor(mensaje, codigo) {
    super(mensaje);
    this.name = "ReglaViolada";
    this.codigo = codigo;
  }
}

export class NoEncontrado extends Error {
  constructor(que) {
    super(`No existe: ${que}`);
    this.name = "NoEncontrado";
    this.codigo = "no_encontrado";
  }
}

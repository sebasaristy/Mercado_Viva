import { definicionDe } from "./TipoMovimiento.js";
import { ReglaViolada } from "./errores.js";

// Una sola responsabilidad: decidir si un movimiento es válido y con qué signo entra
// al libro. No consulta la base, no habla HTTP, no depende de nada de afuera.
// Por eso se puede probar sin levantar nada.
export class Movimiento {
  #datos;

  constructor(datos) {
    this.#datos = Object.freeze({ ...datos });
  }

  // Fábrica: valida las reglas del dominio y devuelve un movimiento ya normalizado.
  // Recibe el producto porque la validación depende de su unidad; no lo va a buscar,
  // se lo tienen que dar. Así el dominio no conoce el repositorio.
  static crear({ id, tenantId, usuarioId, producto, tipo, cantidad, motivo, referencia,
                 ubicacionId = null, creadoEn }) {
    const definicion = definicionDe(tipo);

    const n = Number(cantidad);
    if (!Number.isFinite(n) || n <= 0) {
      throw new ReglaViolada(
        "La cantidad tiene que ser un número mayor que cero.",
        "cantidad_invalida"
      );
    }

    if (producto.unidad === "unidad" && !Number.isInteger(n)) {
      throw new ReglaViolada(
        `${producto.nombre} se maneja por unidad: la cantidad no puede tener decimales.`,
        "decimales_en_unidad"
      );
    }

    if (definicion.exigeMotivo && !String(motivo ?? "").trim()) {
      throw new ReglaViolada(
        `Un movimiento de tipo ${definicion.etiqueta.toLowerCase()} necesita un motivo.`,
        "motivo_requerido"
      );
    }

    const fecha = creadoEn ? new Date(creadoEn) : new Date();
    if (Number.isNaN(fecha.getTime())) {
      throw new ReglaViolada("La fecha del movimiento no es válida.", "fecha_invalida");
    }

    return new Movimiento({
      id, tenantId, usuarioId, ubicacionId,
      productoId: producto.id,
      tipo,
      // El signo lo pone el tipo, nunca quien llama: así "MERMA 3" jamás suma.
      cantidad: definicion.signo * n,
      motivo: motivo ?? null,
      referencia: referencia ?? null,
      creadoEn: fecha
    });
  }

  get id()          { return this.#datos.id; }
  get tenantId()    { return this.#datos.tenantId; }
  get productoId()  { return this.#datos.productoId; }
  get tipo()        { return this.#datos.tipo; }
  get cantidad()    { return this.#datos.cantidad; }
  get delta()       { return this.#datos.cantidad; }
  get creadoEn()    { return this.#datos.creadoEn; }

  get seguroSinRed() { return definicionDe(this.#datos.tipo).seguroSinRed; }

  // Lo que necesita el adaptador para persistirlo. El dominio decide qué expone.
  aPlano() { return { ...this.#datos }; }
}

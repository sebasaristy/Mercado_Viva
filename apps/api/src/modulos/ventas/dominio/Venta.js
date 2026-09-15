import { ReglaViolada } from "./errores.js";

export const METODOS_PAGO = Object.freeze(["efectivo", "tarjeta", "transferencia"]);

// Decide si una venta está bien armada antes de ir a la base.
//
// La base vuelve a validar —precio, que el producto exista, decimales— porque
// es la que tiene la última palabra. Aquí se atrapa lo que se puede decir sin
// preguntarle a nadie, con un mensaje que entienda la cajera.
export class Venta {
  static crear({ id, lineas, metodoPago, recibido }) {
    if (!METODOS_PAGO.includes(metodoPago)) {
      throw new ReglaViolada("Elige cómo pagó el cliente.", "metodo_pago_invalido");
    }

    if (!Array.isArray(lineas) || lineas.length === 0) {
      throw new ReglaViolada("La venta no tiene productos.", "venta_vacia");
    }

    // El mismo producto escaneado dos veces es una sola línea con más cantidad.
    const porProducto = new Map();
    for (const linea of lineas) {
      const cantidad = Number(linea.cantidad);
      if (!Number.isFinite(cantidad) || cantidad <= 0) {
        throw new ReglaViolada(
          "Cada producto de la venta tiene que tener una cantidad mayor que cero.",
          "cantidad_invalida"
        );
      }
      porProducto.set(linea.productoId, (porProducto.get(linea.productoId) ?? 0) + cantidad);
    }

    // Lo recibido solo tiene sentido en efectivo: con tarjeta no hay cambio.
    let recibidoFinal = null;
    if (metodoPago === "efectivo" && recibido !== null && recibido !== undefined && recibido !== "") {
      recibidoFinal = Number(recibido);
      if (!Number.isFinite(recibidoFinal) || recibidoFinal < 0) {
        throw new ReglaViolada("Lo recibido no es un valor válido.", "recibido_invalido");
      }
    }

    return Object.freeze({
      id,
      metodoPago,
      recibido: recibidoFinal,
      // Redondeo a milésimas: sumar 0.1 + 0.2 kg no puede dar 0.30000000000000004.
      lineas: [...porProducto].map(([productoId, cantidad]) => ({
        productoId,
        cantidad: Math.round(cantidad * 1000) / 1000
      }))
    });
  }
}

import { Venta } from "../dominio/Venta.js";
import { ReglaViolada } from "../dominio/errores.js";

const pesos = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 })
    .format(n);

// Lo que la base devuelve como código se traduce a algo que la cajera entienda
// y sepa cómo arreglar. "producto_no_existe" no le sirve a nadie en la caja.
const MENSAJES = {
  producto_no_existe: () =>
    "Uno de los productos ya no está en el catálogo. Quítalo de la venta y vuelve a escanearlo.",
  cantidad_invalida: (r) => `La cantidad de ${r.nombre ?? "un producto"} no es válida.`,
  decimales_en_unidad: (r) =>
    `${r.nombre} se vende por unidad: la cantidad no puede llevar decimales.`,
  recibido_insuficiente: (r) => `Lo recibido no alcanza. El total es ${pesos(r.total)}.`,
  metodo_pago_invalido: () => "Elige cómo pagó el cliente.",
  venta_vacia: () => "La venta no tiene productos."
};

export function crearRegistrarVenta({ repositorio }) {
  return async function registrarVenta(usuario, entrada) {
    const venta = Venta.crear(entrada);

    const r = await repositorio.registrar({
      ...venta,
      tenantId: usuario.tenantId,
      usuarioId: usuario.id
    });

    if (!r.ok) {
      const mensaje = (MENSAJES[r.error] ?? (() => "No se pudo registrar la venta."))(r);
      throw new ReglaViolada(mensaje, r.error, r);
    }

    return { venta: r.venta, alertas: r.alertas ?? [], yaExistia: Boolean(r.yaExistia) };
  };
}

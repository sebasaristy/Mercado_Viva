// Misma interfaz que el adaptador de Supabase, sin base de datos.
// Replica las reglas de registrar_venta que importan para probar el caso de uso:
// precio desde el catálogo, idempotencia, todo o nada, y alertas de stock.
export function crearRepositorioEnMemoria({ productos = {}, existencias = {} } = {}) {
  const ventas = new Map();
  const stock = new Map(Object.entries(existencias));

  return {
    async registrar(v) {
      if (ventas.has(v.id)) return { ok: true, yaExistia: true, venta: ventas.get(v.id), alertas: [] };

      let total = 0;
      for (const l of v.lineas) {
        const p = productos[l.productoId];
        if (!p) return { ok: false, error: "producto_no_existe", productoId: l.productoId };
        if (p.unidad === "unidad" && !Number.isInteger(l.cantidad)) {
          return { ok: false, error: "decimales_en_unidad", nombre: p.nombre };
        }
        total += Math.round(p.precio * l.cantidad);
      }
      if (v.metodoPago === "efectivo" && v.recibido !== null && v.recibido < total) {
        return { ok: false, error: "recibido_insuficiente", total };
      }

      const alertas = [];
      const lineas = v.lineas.map((l) => {
        const p = productos[l.productoId];
        const queda = (stock.get(l.productoId) ?? 0) - l.cantidad;
        stock.set(l.productoId, queda);
        if (queda <= (p.stockMinimo ?? 0)) {
          alertas.push({ productoId: l.productoId, nombre: p.nombre, existencia: queda });
        }
        return { ...l, nombre: p.nombre, precioUnit: p.precio, subtotal: Math.round(p.precio * l.cantidad) };
      });

      const venta = {
        id: v.id,
        total,
        metodoPago: v.metodoPago,
        recibido: v.recibido,
        cambio: v.recibido !== null ? v.recibido - total : null,
        lineas
      };
      ventas.set(v.id, venta);
      return { ok: true, yaExistia: false, venta, alertas };
    },

    _existencia: (productoId) => stock.get(productoId) ?? 0,
    _totalVentas: () => ventas.size
  };
}

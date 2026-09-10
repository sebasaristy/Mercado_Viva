// La misma interfaz, sin Supabase ni red.
//
// No es un juguete: es lo que permite probar las reglas de negocio de verdad,
// en milisegundos. Si esta implementación y la de Supabase no fueran
// intercambiables, el diseño estaría mal — por eso las pruebas de contrato
// corren contra las dos.
export function crearRepositorioEnMemoria() {
  const movimientos = new Map();   // id -> movimiento
  const existencias = new Map();   // "tenant|producto" -> cantidad
  const llave = (t, p) => `${t}|${p}`;

  return {
    // Aquí la atomicidad sale gratis: es una sola función síncrona sobre dos Maps.
    // En Supabase la da la función de Postgres. El contrato es el mismo.
    async registrarMovimiento(m) {
      if (movimientos.has(m.id)) {
        return {
          yaExistia: true,
          existencia: existencias.get(llave(m.tenantId, m.productoId)) ?? 0,
          movimiento: movimientos.get(m.id)
        };
      }

      const guardado = {
        ...m,
        usuario_id: m.usuarioId,
        producto_id: m.productoId,
        creado_en: m.creadoEn,
        registrado_en: new Date()
      };
      movimientos.set(m.id, guardado);

      const k = llave(m.tenantId, m.productoId);
      existencias.set(k, (existencias.get(k) ?? 0) + m.cantidad);

      return { yaExistia: false, existencia: existencias.get(k), movimiento: guardado };
    },

    async existencia(tenantId, productoId) {
      return { cantidad: existencias.get(llave(tenantId, productoId)) ?? 0 };
    },

    async historial(tenantId, productoId, limite = 100) {
      return [...movimientos.values()]
        .filter((m) => m.tenantId === tenantId && m.productoId === productoId)
        .sort((a, b) => new Date(b.creadoEn) - new Date(a.creadoEn))
        .slice(0, limite);
    },

    async porId(id) {
      return movimientos.get(id) ?? null;
    },

    // Ayudas solo para las pruebas. No están en el puerto a propósito:
    // nada del código de producción puede depender de ellas.
    _sembrar(tenantId, productoId, cantidad) {
      existencias.set(llave(tenantId, productoId), cantidad);
    },
    _totalMovimientos() { return movimientos.size; }
  };
}

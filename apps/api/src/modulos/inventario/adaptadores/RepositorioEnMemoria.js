// La misma interfaz, sin base de datos.
//
// No es un juguete: es lo que permite probar las reglas de negocio de verdad,
// en milisegundos y sin Supabase levantado. Si esta implementación y la de
// Postgres no fueran intercambiables, el diseño estaría mal — por eso las
// pruebas de contrato corren contra las dos.
export function crearRepositorioEnMemoria() {
  const movimientos = new Map();   // id -> movimiento
  const existencias = new Map();   // "tenant|producto" -> cantidad
  const llave = (t, p) => `${t}|${p}`;

  return {
    // No hay transacciones reales, pero sí el mismo comportamiento observable:
    // si el callback falla, no queda nada a medias.
    async enTransaccion(fn) {
      const respaldoMov = new Map(movimientos);
      const respaldoEx = new Map(existencias);
      try {
        return await fn({ enMemoria: true });
      } catch (e) {
        movimientos.clear();
        for (const [k, v] of respaldoMov) movimientos.set(k, v);
        existencias.clear();
        for (const [k, v] of respaldoEx) existencias.set(k, v);
        throw e;
      }
    },

    async guardarMovimiento(_tx, m) {
      if (movimientos.has(m.id)) return true;
      movimientos.set(m.id, {
        ...m,
        usuario_id: m.usuarioId,
        creado_en: m.creadoEn,
        registrado_en: new Date()
      });
      return false;
    },

    async aplicarDelta(_tx, tenantId, productoId, delta) {
      const k = llave(tenantId, productoId);
      existencias.set(k, (existencias.get(k) ?? 0) + delta);
    },

    async existencia(tenantId, productoId) {
      return { cantidad: existencias.get(llave(tenantId, productoId)) ?? 0 };
    },

    async historial(tenantId, productoId, limite = 100) {
      return [...movimientos.values()]
        .filter((m) => m.tenantId === tenantId && m.productoId === productoId)
        .sort((a, b) => b.creadoEn - a.creadoEn)
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

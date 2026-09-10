// Los casos de uso de lectura. Solo necesitan la parte de lectura del puerto:
// pedirles el repositorio completo sería obligarlos a conocer métodos que no usan.

export function crearConsultarExistencia({ repositorio }) {
  return async function consultarExistencia(tenantId, productoId) {
    const { cantidad } = await repositorio.existencia(tenantId, productoId);
    return { productoId, cantidad };
  };
}

export function crearVerHistorial({ repositorio }) {
  return async function verHistorial(tenantId, productoId, limite = 100) {
    const [movimientos, { cantidad }] = await Promise.all([
      repositorio.historial(tenantId, productoId, limite),
      repositorio.existencia(tenantId, productoId)
    ]);

    // Para poder leer el libro y ver de dónde salió el número actual, cada
    // movimiento lleva el saldo que dejó. Se camina desde la existencia real hacia
    // atrás —no sumando los movimientos devueltos— porque la lista viene limitada
    // y la suma parcial daría un saldo equivocado.
    let saldo = Number(cantidad);
    const conSaldo = movimientos.map((m) => {
      const fila = { ...m, saldoDespues: saldo };
      saldo -= Number(m.cantidad);
      return fila;
    });

    return { productoId, existenciaActual: Number(cantidad), movimientos: conSaldo };
  };
}

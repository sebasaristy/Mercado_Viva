// El tablero es un modelo de lectura: no decide nada, resume.
//
// Lo único que se calcula aquí y no en la base es la comparación contra ayer,
// porque es presentación: "vas 12% arriba" se entiende más rápido que dos cifras.
// Se compara contra ayer HASTA ESTA MISMA HORA; contra el día completo de ayer,
// a las 11 de la mañana siempre se vería una caída que no existe.
export function crearVerResumen({ repositorio, zona }) {
  return async function verResumen(tenantId) {
    const r = await repositorio.resumen(tenantId, zona);

    const referencia = Number(r.ayer?.ventasALaMismaHora ?? 0);
    const hoy = Number(r.hoy?.ventas ?? 0);
    const variacionPct = referencia > 0
      ? Math.round(((hoy - referencia) / referencia) * 1000) / 10
      : null;

    return {
      ...r,
      comparacion: { variacionPct, contra: "ayer a esta misma hora", referencia }
    };
  };
}

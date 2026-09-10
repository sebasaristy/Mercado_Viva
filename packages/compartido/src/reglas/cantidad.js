// Corre en los dos lados: en la tablet para avisarle al usuario de una vez,
// en el servidor porque no se le cree a nadie.
export function validarCantidad(cantidad, unidad) {
  const n = Number(cantidad);
  if (!Number.isFinite(n)) return "Escribe una cantidad.";
  if (n <= 0) return "La cantidad tiene que ser mayor que cero.";
  if (unidad === "unidad" && !Number.isInteger(n)) {
    return "Este producto se maneja por unidad: no lleva decimales.";
  }
  if (unidad === "kg" && n > 999) return "Revisa el peso: parece demasiado.";
  return null;
}

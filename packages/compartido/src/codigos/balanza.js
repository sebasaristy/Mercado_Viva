// Los EAN-13 que empiezan por 2 los imprime la balanza de la tienda, y traen
// el peso o el precio metido adentro del propio código. No identifican un producto
// por sí solos: hay que partirlos.
//
//   2 P PPPP  V VVVV  C
//     |       |       └ dígito verificador
//     |       └ valor: peso en gramos, o precio
//     └ código interno del producto
//
// El segundo dígito dice qué trae el valor. Cada cadena usa su propia convención:
// esta es la de Mercado Viva y hay que confirmarla contra las balanzas reales.
const PESO = ["0", "1", "2"];
const PRECIO = ["3", "4", "5"];

export function leerCodigoBalanza(codigo) {
  if (!/^2\d{12}$/.test(codigo)) {
    return { esDeBalanza: false, codigoProducto: codigo };
  }

  const marca = codigo[1];
  const codigoProducto = codigo.slice(1, 6);
  const valor = Number(codigo.slice(6, 11));

  if (PESO.includes(marca)) {
    return { esDeBalanza: true, codigoProducto, pesoKg: valor / 1000, precio: null };
  }
  if (PRECIO.includes(marca)) {
    return { esDeBalanza: true, codigoProducto, pesoKg: null, precio: valor };
  }
  return { esDeBalanza: true, codigoProducto, pesoKg: null, precio: null };
}

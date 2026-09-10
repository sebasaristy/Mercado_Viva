export function digitoVerificadorEan(base) {
  const d = [...base].map(Number).reverse();
  const suma = d.reduce((acc, n, i) => acc + n * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (suma % 10)) % 10;
}

export function esEanValido(codigo) {
  if (!/^\d{8}$|^\d{13}$/.test(codigo)) return false;
  const base = codigo.slice(0, -1);
  return digitoVerificadorEan(base) === Number(codigo.at(-1));
}

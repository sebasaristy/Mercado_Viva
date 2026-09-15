// Qué ve cada rol. La API es la que de verdad impide (app.js en la API);
// esto solo evita mostrarle a alguien botones que no le van a funcionar.

export const SECCIONES = [
  { a: "/inventario", icono: "inventario", texto: "Inventario", ayuda: "Entradas y productos nuevos", roles: ["administrador", "bodega"] },
  { a: "/caja", icono: "caja", texto: "Caja", ayuda: "Registrar ventas", roles: ["administrador", "cajero"] },
  { a: "/tablero", icono: "tablero", texto: "Tablero", ayuda: "Cómo va el negocio", roles: ["administrador"] },
  // En el celular no cabe abajo: se llega desde "Cuenta".
  { a: "/usuarios", icono: "usuarios", texto: "Usuarios", ayuda: "Quién entra y qué hace", roles: ["administrador"], soloEscritorio: true }
];

export const ROLES = [
  { valor: "cajero", texto: "Cajero", icono: "caja", descripcion: "Solo la caja: registra ventas." },
  { valor: "bodega", texto: "Bodega", icono: "inventario", descripcion: "Inventario: entradas, merma y productos nuevos." },
  { valor: "administrador", texto: "Admin", icono: "tablero", descripcion: "Todo, más el tablero y los usuarios." }
];

export const nombreDeRol = (rol) =>
  ({ administrador: "Administrador", cajero: "Cajero", bodega: "Bodega" })[rol] ?? rol;

export const seccionesDe = (rol) => SECCIONES.filter((s) => s.roles.includes(rol));

// Adonde llega cada quien al abrir la app: lo que más usa.
export const inicioDe = (rol) =>
  rol === "cajero" ? "/caja" : rol === "bodega" ? "/inventario" : "/tablero";

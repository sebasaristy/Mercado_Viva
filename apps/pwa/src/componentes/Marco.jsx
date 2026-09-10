import { NavLink } from "react-router-dom";
import { Icono } from "./Icono.jsx";
import { BarraSync } from "./BarraSync.jsx";

const PESTANAS = [
  { a: "/bodega", icono: "bodega", texto: "Bodega" },
  { a: "/conteo", icono: "conteo", texto: "Conteo" },
  { a: "/picking", icono: "picking", texto: "Recolección" }
];

// La navegación va abajo: la tablet se sostiene con las dos manos y el pulgar
// no llega arriba. Arriba queda lo que solo se lee — sede y estado de la cola.
export function Marco({ titulo, sede = "Sede Centro", children }) {
  return (
    <div className="flex min-h-dvh flex-col bg-fondo">
      <header className="sticky top-0 z-10 border-b border-borde bg-panel">
        <div className="flex items-baseline justify-between px-4 pt-3 pb-2">
          <h1 className="text-xl font-semibold tracking-tight">{titulo}</h1>
          <span className="text-sm text-tenue">{sede}</span>
        </div>
        <BarraSync />
      </header>

      <main className="flex-1 pb-24">{children}</main>

      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-3 border-t border-borde bg-panel"
      >
        {PESTANAS.map((p) => (
          <NavLink
            key={p.a}
            to={p.a}
            className={({ isActive }) =>
              "flex min-h-16 flex-col items-center justify-center gap-1 text-[13px] font-semibold " +
              "transition-colors duration-100 " +
              (isActive
                ? "border-t-2 border-acento -mt-px text-acento"
                : "text-tenue hover:text-tinta")
            }
          >
            <Icono nombre={p.icono} tam={21} />
            {p.texto}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

// Una fila de lista. Separador de un pixel, sin tarjetas flotando:
// es una herramienta de trabajo, no un catálogo.
export function Fila({ children, onClick, className = "" }) {
  const Elemento = onClick ? "button" : "div";
  return (
    <Elemento
      onClick={onClick}
      className={
        "flex w-full items-center gap-3 border-b border-borde bg-panel px-4 py-3 text-left " +
        (onClick ? "min-h-14 transition-colors duration-100 hover:bg-panel-alt " : "") +
        className
      }
    >
      {children}
    </Elemento>
  );
}

export function Vacio({ icono, titulo, detalle, accion }) {
  return (
    <div className="flex flex-col items-center gap-3 px-8 py-16 text-center">
      <span className="text-borde-fuerte">
        <Icono nombre={icono} tam={40} />
      </span>
      <p className="text-[17px] font-semibold">{titulo}</p>
      <p className="max-w-[36ch] text-[15px] text-tenue">{detalle}</p>
      {accion}
    </div>
  );
}

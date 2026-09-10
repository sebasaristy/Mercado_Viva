import { Icono } from "./Icono.jsx";

// 56px de alto mínimo, no 44: esto se toca con guantes y con la tablet en una mano.
// El borde hace el trabajo visual; no hay sombras en ninguna parte de la app.
const TONOS = {
  principal:
    "bg-acento text-white border-acento hover:bg-acento-hover active:bg-acento-hover disabled:bg-borde-fuerte disabled:border-borde-fuerte",
  neutro:
    "bg-panel text-tinta border-borde-fuerte hover:bg-panel-alt active:bg-panel-alt",
  peligro:
    "bg-panel text-peligro border-peligro hover:bg-peligro-suave active:bg-peligro-suave"
};

export function Boton({
  children, onClick, tono = "neutro", icono, tipo = "button",
  disabled, cargando, className = ""
}) {
  return (
    <button
      type={tipo}
      onClick={onClick}
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={
        "inline-flex min-h-14 w-full items-center justify-center gap-2.5 " +
        "rounded-pieza border-2 px-5 text-[17px] font-semibold " +
        "transition-colors duration-100 disabled:cursor-not-allowed disabled:text-white " +
        TONOS[tono] + " " + className
      }
    >
      {icono && !cargando && <Icono nombre={icono} />}
      {cargando && (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  );
}

// Los tipos de movimiento se eligen tocando, no en un <select>: un desplegable
// en una tablet con guantes es lento y se falla.
export function Opcion({ activo, onClick, icono, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={
        "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 " +
        "rounded-pieza border-2 px-2 py-2 text-sm font-semibold " +
        "transition-colors duration-100 " +
        (activo
          ? "border-acento bg-acento-suave text-acento"
          : "border-borde bg-panel text-tenue hover:border-borde-fuerte")
      }
    >
      <Icono nombre={icono} tam={20} />
      {children}
    </button>
  );
}

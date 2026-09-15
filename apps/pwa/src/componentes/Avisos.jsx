import { create } from "zustand";
import { Icono } from "./Icono.jsx";

// Confirmaciones breves de que algo se guardó. Se van solas; los errores que
// requieren una acción no van aquí, van junto a lo que hay que corregir.
const usarAvisos = create((set, get) => ({
  lista: [],
  mostrar(aviso) {
    const id = Math.random().toString(36).slice(2);
    const duracion = aviso.duracion ?? 5000;
    set({ lista: [...get().lista, { id, tono: "exito", ...aviso }].slice(-3) });
    setTimeout(() => get().quitar(id), duracion);
  },
  quitar: (id) => set({ lista: get().lista.filter((a) => a.id !== id) })
}));

export const avisar = (aviso) => usarAvisos.getState().mostrar(aviso);

const TONOS = {
  exito: { borde: "border-ok", icono: "listo", color: "text-ok" },
  atencion: { borde: "border-acento", icono: "subir", color: "text-acento" },
  error: { borde: "border-peligro", icono: "alerta", color: "text-peligro" }
};

export function ZonaAvisos() {
  const { lista, quitar } = usarAvisos();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end"
    >
      {lista.map((a) => {
        const t = TONOS[a.tono] ?? TONOS.exito;
        return (
          <div
            key={a.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-pieza border-2 bg-panel px-4 py-3 shadow-[0_10px_30px_-12px_rgba(22,25,15,0.35)] ${t.borde}`}
          >
            <Icono nombre={t.icono} tam={20} className={"mt-0.5 " + t.color} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold leading-snug">{a.titulo}</p>
              {a.texto && <p className="mt-0.5 text-[15px] text-tenue">{a.texto}</p>}
            </div>
            <button
              type="button"
              onClick={() => quitar(a.id)}
              aria-label="Cerrar aviso"
              className="-mr-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-pieza text-tenue hover:bg-panel-alt"
            >
              <Icono nombre="cerrar" tam={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

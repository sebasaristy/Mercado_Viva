import { Icono } from "./Icono.jsx";
import { estadoSync } from "../local/estado.js";
import { vaciarCola } from "../local/sync.js";

// Siempre visible cuando hay algo sin subir. No es decoración: si una merma
// lleva media hora en la tablet y nadie se entera, el inventario queda mal
// y nadie sabe por qué. Nada puede perderse en silencio.
export function BarraSync() {
  const { pendientes, sincronizando, hayRed, ultimaSync } = estadoSync();

  if (pendientes === 0 && hayRed) return null;

  const grave = !hayRed || pendientes > 8;

  return (
    <div
      role="status"
      className={
        "flex items-center gap-3 border-b px-4 py-2.5 text-[15px] " +
        (grave
          ? "border-peligro/30 bg-peligro-suave text-peligro"
          : "border-borde bg-acento-suave text-acento")
      }
    >
      <Icono nombre={hayRed ? "subir" : "sinRed"} tam={19} />

      <span className="flex-1 font-medium">
        {!hayRed && pendientes === 0 && "Sin conexión. Puedes seguir trabajando."}
        {!hayRed && pendientes > 0 &&
          `Sin conexión · ${pendientes} ${pendientes === 1 ? "operación guardada" : "operaciones guardadas"}`}
        {hayRed && sincronizando && "Subiendo…"}
        {hayRed && !sincronizando && pendientes > 0 &&
          `${pendientes} sin subir`}
      </span>

      {hayRed && !sincronizando && pendientes > 0 && (
        <button
          onClick={vaciarCola}
          className="min-h-9 rounded-pieza border border-current px-3 text-sm font-semibold"
        >
          Reintentar
        </button>
      )}

      {ultimaSync && pendientes === 0 && (
        <span className="cifras text-sm opacity-70">
          {ultimaSync.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}
    </div>
  );
}

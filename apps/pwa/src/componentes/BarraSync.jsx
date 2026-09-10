import { estadoSync } from "../local/estado.js";
import { vaciarCola } from "../local/sync.js";

export function BarraSync() {
  const { pendientes, sincronizando, ultimaSync } = estadoSync();
  if (pendientes === 0 && !sincronizando) return null;

  return (
    <div role="status" style={{
      position: "sticky", top: 0, zIndex: 10,
      padding: "10px 14px", fontSize: 15,
      background: pendientes > 0 ? "#f5eada" : "#eef3ee"
    }}>
      {sincronizando
        ? "Subiendo…"
        : pendientes + (pendientes === 1 ? " operación sin subir" : " operaciones sin subir")}
      {!sincronizando && (
        <button onClick={vaciarCola} style={{ marginLeft: 12 }}>Reintentar</button>
      )}
      {ultimaSync && (
        <span style={{ marginLeft: 12, opacity: .7 }}>
          última: {ultimaSync.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
}

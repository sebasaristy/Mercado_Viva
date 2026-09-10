import { useState } from "react";
import { validarCantidad } from "@mv/compartido";
import { Escaner } from "../../componentes/Escaner.jsx";
import { BotonGrande } from "../../componentes/BotonGrande.jsx";
import { encolar } from "../../local/cola.js";
import { estadoSync } from "../../local/estado.js";
import { buscarProductoLocal } from "./datos.js";

// Entradas de proveedor, merma y traslados.
// No llama a la API: escribe en la cola y sigue. Con red o sin red, igual.
export function Bodega() {
  const [producto, setProducto] = useState(null);
  const [cantidad, setCantidad] = useState("");
  const [tipo, setTipo] = useState("ENTRADA");
  const [aviso, setAviso] = useState(null);

  async function alEscanear(codigo) {
    const p = await buscarProductoLocal(codigo);
    setProducto(p ?? { desconocido: true, codigoBarras: codigo });
  }

  async function guardar() {
    const problema = validarCantidad(cantidad, producto.unidad);
    if (problema) return setAviso(problema);

    await encolar("movimiento", "/inventario/movimientos", {
      productoId: producto.id,
      tipo,
      cantidad: Number(cantidad)
    });

    estadoSync.getState().refrescarPendientes();
    setAviso("Guardado. Se sube solo cuando haya señal.");
    setProducto(null);
    setCantidad("");
  }

  return (
    <main style={{ padding: 16, display: "grid", gap: 16, maxWidth: 520 }}>
      <h1 style={{ fontSize: 22 }}>Bodega</h1>
      <Escaner onCodigo={alEscanear} />

      {producto && !producto.desconocido && (
        <>
          <div><strong>{producto.nombre}</strong></div>
          <select value={tipo} onChange={(e) => setTipo(e.target.value)}
                  style={{ fontSize: 19, padding: 12 }}>
            <option value="ENTRADA">Entrada de proveedor</option>
            <option value="MERMA">Merma</option>
            <option value="TRASLADO">Traslado</option>
          </select>
          <input value={cantidad} onChange={(e) => setCantidad(e.target.value)}
                 inputMode="decimal" placeholder="Cantidad"
                 style={{ fontSize: 22, padding: 14 }} />
          <BotonGrande onClick={guardar}>Guardar</BotonGrande>
        </>
      )}

      {producto?.desconocido && (
        <p>Ese código no está en el catálogo. Regístralo primero.</p>
      )}
      {aviso && <p role="status">{aviso}</p>}
    </main>
  );
}

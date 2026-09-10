import { useState, useRef } from "react";
import { Marco, Fila, Vacio } from "../../componentes/Marco.jsx";
import { Boton } from "../../componentes/Boton.jsx";
import { Campo } from "../../componentes/Campo.jsx";
import { buscarProductoLocal } from "../bodega/datos.js";

// Conteo ciego: el contador NO ve cuánto se supone que hay. Escribe lo que ve,
// y la diferencia la calcula el servidor al cerrar la sesión. Si viera el
// esperado, el dato dejaría de ser un conteo y pasaría a ser una confirmación.
//
// La zona viene asignada en exclusiva: dos personas nunca cuentan el mismo
// pasillo, así que aquí no hay conflictos que resolver.
export function Conteo() {
  const [zona] = useState({ nombre: "Pasillo 3 — Abarrotes", total: 42 });
  const [codigo, setCodigo] = useState("");
  const [producto, setProducto] = useState(null);
  const [cantidad, setCantidad] = useState("");
  const [error, setError] = useState(null);
  const [contados, setContados] = useState([]);
  const campoCodigo = useRef(null);

  async function buscar() {
    const p = await buscarProductoLocal(codigo.trim());
    if (!p) return setError("Ese código no está en el catálogo.");
    setError(null);
    setProducto(p);
    setCantidad(p.pesoKg ? String(p.pesoKg) : "");
  }

  function anotar() {
    if (cantidad === "" || Number(cantidad) < 0) {
      return setError("Escribe cuántas unidades hay.");
    }
    setContados((c) => [
      { nombre: producto.nombre, cantidad: Number(cantidad), unidad: producto.unidad },
      ...c.filter((x) => x.nombre !== producto.nombre)
    ]);
    setProducto(null);
    setCodigo("");
    setCantidad("");
    setError(null);
    campoCodigo.current?.focus();
  }

  const avance = Math.round((contados.length / zona.total) * 100);

  return (
    <Marco titulo="Conteo">
      <section className="border-b border-borde bg-panel px-4 py-4">
        <div className="flex items-baseline justify-between">
          <p className="text-[17px] font-semibold">{zona.nombre}</p>
          <p className="cifras text-sm text-tenue">
            {contados.length} de {zona.total}
          </p>
        </div>

        {/* Barra de avance sin adorno: un riel y un relleno. */}
        <div
          className="mt-2 h-2 w-full overflow-hidden rounded-pieza bg-panel-alt"
          role="progressbar"
          aria-valuenow={avance}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Avance del conteo de la zona"
        >
          <div className="h-full bg-acento transition-[width] duration-100" style={{ width: avance + "%" }} />
        </div>

        <p className="mt-2 text-sm text-tenue">
          Escribe lo que ves en el estante. No te mostramos el esperado a propósito.
        </p>
      </section>

      <section className="border-b border-borde bg-panel px-4 py-4">
        <Campo
          etiqueta="Código del producto"
          refCampo={campoCodigo}
          valor={codigo}
          onChange={setCodigo}
          alPresionarEnter={buscar}
          ejemplo="Escanea o escribe"
          inputMode="numeric"
          autoFoco
          error={!producto ? error : null}
        />

        {producto && (
          <div className="mt-4">
            <p className="text-[19px] font-semibold leading-tight">{producto.nombre}</p>
            <div className="mt-3">
              <Campo
                etiqueta="Cuántas hay"
                valor={cantidad}
                onChange={(v) => { setCantidad(v); setError(null); }}
                ejemplo="0"
                inputMode="decimal"
                sufijo={producto.unidad === "kg" ? "kg" : "und"}
                error={error}
              />
            </div>
            <div className="mt-4 flex gap-2">
              <Boton tono="neutro" onClick={() => { setProducto(null); setCodigo(""); }}>
                Cancelar
              </Boton>
              <Boton tono="principal" onClick={anotar} icono="listo">
                Anotar
              </Boton>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="px-4 pt-5 pb-2 text-sm font-semibold uppercase tracking-wide text-tenue">
          Contados en esta zona
        </h2>

        {contados.length === 0 ? (
          <Vacio
            icono="conteo"
            titulo="Zona sin empezar"
            detalle="Escanea el primer producto del pasillo. Puedes contar sin conexión: la zona es solo tuya."
          />
        ) : (
          contados.map((c, i) => (
            <Fila key={i}>
              <span className="flex-1 truncate">{c.nombre}</span>
              <span className="cifras text-[17px] font-semibold">
                {c.cantidad} <span className="text-sm font-normal text-tenue">{c.unidad === "kg" ? "kg" : "und"}</span>
              </span>
            </Fila>
          ))
        )}
      </section>

      {contados.length > 0 && (
        <div className="px-4 py-5">
          <Boton tono="neutro" icono="subir" disabled={contados.length < zona.total}>
            Cerrar zona
          </Boton>
          {contados.length < zona.total && (
            <p className="mt-2 text-center text-sm text-tenue">
              Faltan {zona.total - contados.length} productos por contar.
            </p>
          )}
        </div>
      )}
    </Marco>
  );
}

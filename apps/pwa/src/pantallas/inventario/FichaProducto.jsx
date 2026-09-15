import { useState } from "react";
import { validarCantidad } from "@mv/compartido";
import { Aviso, Boton, Cantidad, EstadoStock, Segmentado } from "../../componentes/ui.jsx";
import { avisar } from "../../componentes/Avisos.jsx";
import { ejecutar } from "../../local/operar.js";
import { guardarEnCache } from "../../local/catalogo.js";
import { conUnidad, corta, margen, num, pesos } from "../../lib/formato.js";

const MOTIVOS = ["Vencido", "Dañado", "Robo", "Otro"];

const estadoDe = (existencia, minimo) =>
  existencia <= 0 ? "agotado" : existencia <= Number(minimo) ? "bajo" : "ok";

// Un producto encontrado: cuánto hay, cuánto deja, y las dos cosas que le
// pueden pasar en bodega — que llegue mercancía o que se pierda.
export function FichaProducto({ producto, pesoKg, onActualizado, onCerrar }) {
  const [accion, setAccion] = useState("ENTRADA");
  const [cantidad, setCantidad] = useState(pesoKg ? String(pesoKg) : "");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const m = margen(producto.precio, producto.costo);
  const n = Number(cantidad);
  const hayCantidad = cantidad !== "" && Number.isFinite(n) && n > 0;
  const quedara = hayCantidad
    ? Math.round((Number(producto.existencia) + (accion === "ENTRADA" ? n : -n)) * 1000) / 1000
    : null;

  async function guardar() {
    const problema = validarCantidad(cantidad, producto.unidad);
    if (problema) return setError(problema);
    if (accion === "MERMA" && !motivo) return setError("Elige por qué se perdió.");

    setError(null);
    setGuardando(true);
    try {
      const r = await ejecutar("/inventario/movimientos", {
        productoId: producto.id,
        tipo: accion,
        cantidad: n,
        motivo: accion === "MERMA" ? motivo : null
      });

      const existencia = r.enLinea ? Number(r.datos.existencia) : quedara;
      const actualizado = { ...producto, existencia, estado: estadoDe(existencia, producto.stockMinimo) };
      await guardarEnCache(actualizado);
      onActualizado(actualizado);

      avisar({
        tono: r.enLinea ? "exito" : "atencion",
        titulo: accion === "ENTRADA"
          ? `Ingresaste ${conUnidad(n, producto.unidad)}`
          : `Registraste merma de ${conUnidad(n, producto.unidad)}`,
        texto: r.enLinea
          ? `${producto.nombre}: ahora hay ${conUnidad(existencia, producto.unidad)}.`
          : "Sin conexión: quedó guardado en este equipo y se sube solo."
      });

      setCantidad("");
      setMotivo("");
    } catch (e) {
      setError(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section aria-labelledby="ficha-titulo" className="rounded-pieza border border-borde bg-panel">
      <div className="flex items-start justify-between gap-3 border-b border-borde px-4 py-3.5">
        <div className="min-w-0">
          <h2 id="ficha-titulo" className="text-xl font-semibold leading-tight">{producto.nombre}</h2>
          <p className="mt-1 text-sm text-tenue">
            {producto.categoria}
            {" · "}
            {producto.codigoBarras
              ? <span className="cifras">{producto.codigoBarras}</span>
              : "sin código"}
          </p>
        </div>
        <Boton tono="fantasma" tam="chico" icono="cerrar" onClick={onCerrar} aria-label="Cerrar producto" />
      </div>

      <dl className="grid grid-cols-3 divide-x divide-borde border-b border-borde">
        <div className="flex flex-col gap-1.5 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-tenue">En stock</dt>
          <dd className="cifras text-2xl font-semibold leading-none">{corta(producto.existencia, producto.unidad)}</dd>
          <dd><EstadoStock estado={producto.estado} /></dd>
        </div>
        <div className="flex flex-col gap-1.5 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-tenue">
            {producto.unidad === "kg" ? "Precio / kg" : "Precio"}
          </dt>
          <dd className="cifras text-lg font-semibold leading-none">{pesos(producto.precio)}</dd>
          <dd className="text-xs text-tenue">costo {pesos(producto.costo)}</dd>
        </div>
        <div className="flex flex-col gap-1.5 px-4 py-3">
          <dt className="text-xs font-semibold uppercase tracking-wide text-tenue">Margen</dt>
          <dd className={`cifras text-lg font-semibold leading-none ${m && m.valor < 0 ? "text-peligro" : ""}`}>
            {m && Number(producto.costo) > 0 ? `${num(m.pct)} %` : "—"}
          </dd>
          <dd className="text-xs text-tenue">
            {m && Number(producto.costo) > 0 ? `${pesos(m.valor)} por ${producto.unidad === "kg" ? "kg" : "unidad"}` : "sin costo"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-4 p-4">
        <Segmentado
          etiqueta="¿Qué pasó con este producto?"
          valor={accion}
          onCambio={(v) => { setAccion(v); setError(null); }}
          opciones={[
            { valor: "ENTRADA", texto: "Llegó mercancía", icono: "entrada" },
            { valor: "MERMA", texto: "Se perdió", icono: "alerta" }
          ]}
        />

        <Cantidad
          id="ficha-cantidad"
          etiqueta={accion === "ENTRADA" ? "¿Cuánto llegó?" : "¿Cuánto se perdió?"}
          valor={cantidad}
          onCambio={(v) => { setCantidad(v); setError(null); }}
          unidad={producto.unidad}
        />

        {accion === "MERMA" && (
          <Segmentado
            etiqueta="¿Por qué?"
            valor={motivo}
            onCambio={(v) => { setMotivo(v); setError(null); }}
            opciones={MOTIVOS.map((x) => ({ valor: x, texto: x }))}
          />
        )}

        {quedara !== null && (
          <p className="flex items-center justify-between gap-3 rounded-pieza bg-panel-alt px-3.5 py-2.5 text-[15px]">
            <span className="text-tenue">Al guardar quedan</span>
            <span className="cifras font-semibold">
              {corta(producto.existencia, producto.unidad)}
              <span className="px-1.5 text-tenue">→</span>
              <span className={quedara < 0 ? "text-peligro" : ""}>{corta(quedara, producto.unidad)}</span>
            </span>
          </p>
        )}

        {quedara !== null && quedara < 0 && (
          <Aviso tono="atencion" titulo="El sistema quedaría en negativo">
            Revisa la cantidad. Si de verdad se perdió eso, el stock registrado estaba mal: conviene contar el producto.
          </Aviso>
        )}

        {error && <Aviso tono="error">{error}</Aviso>}

        <Boton
          tono="principal"
          tam="grande"
          icono="listo"
          cargando={guardando}
          disabled={!hayCantidad}
          onClick={guardar}
        >
          {accion === "ENTRADA"
            ? hayCantidad ? `Ingresar ${conUnidad(n, producto.unidad)}` : "Escribe cuánto llegó"
            : hayCantidad ? `Registrar merma de ${conUnidad(n, producto.unidad)}` : "Escribe cuánto se perdió"}
        </Boton>
      </div>
    </section>
  );
}

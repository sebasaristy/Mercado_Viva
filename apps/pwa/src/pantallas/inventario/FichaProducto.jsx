import { useState } from "react";
import { validarCantidad } from "@mv/compartido";
import { Aviso, Boton, Campo, Cantidad, Chips, EstadoStock, Segmentado } from "../../componentes/ui.jsx";
import { avisar } from "../../componentes/Avisos.jsx";
import { Icono } from "../../componentes/Icono.jsx";
import { cambiarJson } from "../../api/cliente.js";
import { ejecutar } from "../../local/operar.js";
import { guardarEnCache } from "../../local/catalogo.js";
import { conUnidad, corta, margen, num, pesos, soloDigitos } from "../../lib/formato.js";
import { CATEGORIAS } from "./NuevoProducto.jsx";

const MOTIVOS = ["Vencido", "Dañado", "Robo", "Otro"];

// Un producto que la caja registró con solo nombre y precio. Bodega le pone
// categoría, costo y mínimo, y lo cuenta: con eso deja de estar por revisar.
function CompletarDatos({ producto, onCompletado }) {
  const [f, setF] = useState({ nombre: producto.nombre, precio: String(Math.round(producto.precio)), categoria: "", costo: "", stockMinimo: "", contados: "" });
  const [errores, setErrores] = useState({});
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const poner = (campo) => (valor) => {
    setF((x) => ({ ...x, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: null }));
    setError(null);
  };
  const m = margen(f.precio, f.costo);

  async function guardar() {
    const e = {};
    if (f.nombre.trim().length < 2) e.nombre = "Escribe el nombre del producto.";
    if (!(Number(f.precio) > 0)) e.precio = "Escribe el precio de venta.";
    if (!f.categoria) e.categoria = "Elige una categoría.";
    // Contar cero es válido (no hay ninguno); lo que no vale son decimales por unidad.
    if (f.contados !== "") {
      const contados = Number(f.contados);
      if (!Number.isFinite(contados) || contados < 0) e.contados = "La cantidad no es válida.";
      else if (producto.unidad === "unidad" && !Number.isInteger(contados)) e.contados = "Por unidad no lleva decimales.";
    }
    setErrores(e);
    if (Object.keys(e).length) return;

    setGuardando(true);
    try {
      const actualizado = await cambiarJson(`/catalogo/productos/${producto.id}`, {
        nombre: f.nombre.trim(),
        precio: Number(f.precio),
        categoria: f.categoria,
        costo: Number(f.costo || 0),
        stockMinimo: Number(f.stockMinimo || 0)
      });

      // Lo contado se registra como entrada o salida por la diferencia: el
      // stock sigue siendo un libro de movimientos, nunca un número pisado.
      let existencia = Number(actualizado.existencia);
      if (f.contados !== "") {
        const diferencia = Math.round((Number(f.contados) - existencia) * 1000) / 1000;
        if (diferencia !== 0) {
          const r = await ejecutar("/inventario/movimientos", {
            productoId: producto.id,
            tipo: diferencia > 0 ? "ENTRADA" : "SALIDA",
            cantidad: Math.abs(diferencia),
            motivo: "Conteo al revisar producto registrado en caja"
          });
          existencia = r.enLinea ? Number(r.datos.existencia) : Number(f.contados);
        }
      }

      const final = { ...actualizado, existencia, estado: estadoDe(existencia, actualizado.stockMinimo) };
      await guardarEnCache(final);
      onCompletado(final);
      avisar({ titulo: `«${final.nombre}» quedó revisado`, texto: `Ahora hay ${conUnidad(existencia, final.unidad)}.` });
    } catch (err) {
      if (err.campo) setErrores((x) => ({ ...x, [err.campo]: err.message }));
      else setError(err.deRed ? "Completar el producto necesita conexión. Intenta cuando vuelva la señal." : err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="flex flex-col gap-4 border-b border-borde bg-acento-suave/50 p-4">
      <div>
        <p className="flex items-center gap-2 font-semibold text-acento">
          <Icono nombre="alerta" tam={18} />
          Registrado desde la caja: complétalo
        </p>
        <p className="mt-0.5 text-[15px] text-tinta">
          Se registró con solo nombre y precio para no frenar la venta. Ponle categoría y costo, y cuenta cuántos hay.
        </p>
      </div>

      <Campo id="rev-nombre" etiqueta="Nombre" value={f.nombre} autoComplete="off"
        onChange={(e) => poner("nombre")(e.target.value)} error={errores.nombre} />
      <Chips etiqueta="Categoría" opciones={CATEGORIAS} valor={f.categoria} onCambio={poner("categoria")} error={errores.categoria} />

      <div className="grid grid-cols-2 gap-3">
        <Campo id="rev-precio" etiqueta={producto.unidad === "kg" ? "Precio por kilo" : "Precio de venta"} prefijo="$" inputMode="numeric"
          value={f.precio} onChange={(e) => poner("precio")(soloDigitos(e.target.value))} error={errores.precio} />
        <Campo id="rev-costo" etiqueta="Lo que te cuesta" prefijo="$" inputMode="numeric" placeholder="0"
          value={f.costo} onChange={(e) => poner("costo")(soloDigitos(e.target.value))} />
      </div>

      {m && Number(f.costo) > 0 && (
        <p className={`rounded-pieza px-3.5 py-2.5 text-[15px] ${m.valor < 0 ? "bg-peligro-suave text-peligro" : "bg-panel text-tinta"}`}>
          {m.valor < 0
            ? `Se está vendiendo ${pesos(-m.valor)} por debajo del costo.`
            : <>Ganas <strong className="cifras">{pesos(m.valor)}</strong> · margen <strong className="cifras">{num(m.pct)} %</strong></>}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Campo id="rev-minimo" etiqueta="Avisar si quedan menos de" inputMode="decimal" sufijo={producto.unidad === "kg" ? "kg" : "und"} placeholder="0"
          value={f.stockMinimo} onChange={(e) => poner("stockMinimo")(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))} />
        <Campo id="rev-contados" etiqueta="¿Cuántos hay en estante?" inputMode="decimal" sufijo={producto.unidad === "kg" ? "kg" : "und"}
          placeholder={num(producto.existencia)} ayuda="Opcional"
          value={f.contados} onChange={(e) => poner("contados")(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))} error={errores.contados} />
      </div>

      {error && <Aviso tono="error" titulo="No se guardó">{error}</Aviso>}

      <Boton tono="principal" icono="listo" cargando={guardando} onClick={guardar}>
        Guardar y marcar como revisado
      </Boton>
    </div>
  );
}

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

      {producto.porRevisar && <CompletarDatos producto={producto} onCompletado={onActualizado} />}

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

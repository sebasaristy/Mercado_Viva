import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Contenido, Encabezado } from "../../componentes/Estructura.jsx";
import { LectorCodigo } from "../../componentes/LectorCodigo.jsx";
import { Aviso, Boton, Campo, Cantidad, Seccion, Segmentado } from "../../componentes/ui.jsx";
import { Icono } from "../../componentes/Icono.jsx";
import { buscarProducto, ejecutar } from "../../local/operar.js";
import { productosEnCache, refrescarCatalogo } from "../../local/catalogo.js";
import { corta, hora, num, pesos, soloDigitos } from "../../lib/formato.js";

const PAGOS = [
  { valor: "efectivo", texto: "Efectivo", icono: "efectivo" },
  { valor: "tarjeta", texto: "Tarjeta", icono: "tarjeta" },
  { valor: "transferencia", texto: "Transferencia", icono: "transferencia" }
];
const NOMBRE_PAGO = Object.fromEntries(PAGOS.map((p) => [p.valor, p.texto]));

const subtotalDe = (l) => Math.round(Number(l.producto.precio) * (Number(l.cantidad) || 0));

// Con qué billete paga probablemente el cliente: el valor exacto y los
// redondeos siguientes. Ahorra escribir el recibido en cada venta.
function billetesProbables(total) {
  if (total <= 0) return [];
  const opciones = new Set([total]);
  for (const b of [5000, 10000, 20000, 50000, 100000]) opciones.add(Math.ceil(total / b) * b);
  return [...opciones].sort((a, b) => a - b).slice(0, 4);
}

export function Caja() {
  const navigate = useNavigate();
  const [lineas, setLineas] = useState([]);
  const [vaciadas, setVaciadas] = useState(null);
  const [metodo, setMetodo] = useState("efectivo");
  const [recibido, setRecibido] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [errorCobro, setErrorCobro] = useState(null);
  const [cobrando, setCobrando] = useState(false);
  const [recibo, setRecibo] = useState(null);
  const [catalogo, setCatalogo] = useState([]);
  const [porNombre, setPorNombre] = useState("");

  useEffect(() => {
    refrescarCatalogo()
      .then(setCatalogo)
      .catch(async () => setCatalogo(await productosEnCache()));
  }, []);

  // El mismo producto escaneado otra vez suma cantidad y sube arriba de la lista,
  // que es donde la cajera está mirando.
  const agregar = useCallback((producto, cantidad = 1) => {
    setLineas((ls) => {
      const i = ls.findIndex((l) => l.producto.id === producto.id);
      if (i === -1) return [{ producto, cantidad: String(cantidad) }, ...ls];
      const suma = Math.round((Number(ls[i].cantidad || 0) + cantidad) * 1000) / 1000;
      return [{ producto, cantidad: String(suma) }, ...ls.filter((_, j) => j !== i)];
    });
    setVaciadas(null);
    setErrorCobro(null);
  }, []);

  const leerCodigo = useCallback(async (codigo) => {
    setBuscando(true);
    setAviso(null);
    try {
      const r = await buscarProducto(codigo);
      if (!r.producto) {
        setAviso({ tipo: "noExiste", codigo: r.codigo });
        return;
      }
      agregar(r.producto, r.pesoKg ?? 1);
      if (!r.enLinea) setAviso({ tipo: "sinConexion" });
    } catch (e) {
      setAviso({ tipo: "error", mensaje: e.message });
    } finally {
      setBuscando(false);
    }
  }, [agregar]);

  const cambiarCantidad = (id, cantidad) =>
    setLineas((ls) => ls.map((l) => (l.producto.id === id ? { ...l, cantidad } : l)));
  const quitar = (id) => setLineas((ls) => ls.filter((l) => l.producto.id !== id));

  const total = useMemo(() => lineas.reduce((s, l) => s + subtotalDe(l), 0), [lineas]);
  const recibidoNum = recibido === "" ? null : Number(recibido);
  const cambio = metodo === "efectivo" && recibidoNum !== null ? recibidoNum - total : null;

  const lineaInvalida = lineas.find(
    (l) => !(Number(l.cantidad) > 0) ||
      (l.producto.unidad === "unidad" && !Number.isInteger(Number(l.cantidad)))
  );
  const faltaEfectivo = metodo === "efectivo" && recibidoNum !== null && recibidoNum < total;
  const puedeCobrar = lineas.length > 0 && !lineaInvalida && !faltaEfectivo;

  // Si el botón está apagado, se dice por qué, en vez de dejar adivinando.
  const porQueNo =
    lineas.length === 0 ? "Agrega al menos un producto."
    : lineaInvalida ? `Revisa la cantidad de ${lineaInvalida.producto.nombre}.`
    : faltaEfectivo ? `Faltan ${pesos(total - recibidoNum)} por recibir.`
    : null;

  const coincidencias = useMemo(() => {
    const q = porNombre.trim().toLowerCase();
    if (q.length < 2) return [];
    return catalogo.filter((p) => p.nombre.toLowerCase().includes(q)).slice(0, 6);
  }, [porNombre, catalogo]);

  async function cobrar() {
    if (!puedeCobrar || cobrando) return;
    setCobrando(true);
    setErrorCobro(null);

    const cuerpo = {
      metodoPago: metodo,
      recibido: metodo === "efectivo" ? recibidoNum : null,
      lineas: lineas.map((l) => ({ productoId: l.producto.id, cantidad: Number(l.cantidad) }))
    };

    try {
      const r = await ejecutar("/ventas", cuerpo);
      setRecibo(
        r.enLinea
          ? { enLinea: true, venta: r.datos.venta, alertas: r.datos.alertas }
          : {
              enLinea: false,
              alertas: [],
              venta: {
                id: r.id,
                total,
                metodoPago: metodo,
                recibido: cuerpo.recibido,
                cambio,
                creadoEn: new Date().toISOString(),
                lineas: lineas.map((l) => ({
                  productoId: l.producto.id,
                  nombre: l.producto.nombre,
                  unidad: l.producto.unidad,
                  cantidad: Number(l.cantidad),
                  precioUnit: l.producto.precio,
                  subtotal: subtotalDe(l)
                }))
              }
            }
      );
      setLineas([]);
      setRecibido("");
      setMetodo("efectivo");
      setPorNombre("");
      setAviso(null);
      refrescarCatalogo().then(setCatalogo).catch(() => {});
    } catch (e) {
      setErrorCobro(e.message);
    } finally {
      setCobrando(false);
    }
  }

  if (recibo) {
    return (
      <>
        <Encabezado titulo="Caja" descripcion="Venta terminada. Entrega el cambio y empieza la siguiente." />
        <Contenido>
          <Recibo recibo={recibo} onNueva={() => setRecibo(null)} />
        </Contenido>
      </>
    );
  }

  return (
    <>
      <Encabezado
        titulo="Caja"
        descripcion="Escanea los productos del cliente, elige cómo paga y cobra. El precio sale del catálogo."
      />
      <Contenido>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <Seccion>
              <LectorCodigo onCodigo={leerCodigo} ocupado={buscando} etiqueta="Escanea un producto" />

              <div className="mt-4 flex flex-col gap-1.5">
                <label htmlFor="caja-nombre" className="text-sm font-semibold text-tinta">
                  O búscalo por nombre
                </label>
                <div className="relative">
                  <Icono nombre="buscar" tam={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tenue" />
                  <input
                    id="caja-nombre"
                    value={porNombre}
                    onChange={(e) => setPorNombre(e.target.value)}
                    placeholder="Ej: banano, leche…"
                    autoComplete="off"
                    className="min-h-12 w-full rounded-pieza border-2 border-borde-fuerte bg-panel pl-10 pr-3 text-[17px] placeholder:text-tenue/60 focus:border-acento"
                  />
                </div>
                {coincidencias.length > 0 && (
                  <ul className="mt-1 divide-y divide-borde rounded-pieza border border-borde">
                    {coincidencias.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => { agregar(p, 1); setPorNombre(""); }}
                          className="flex min-h-12 w-full items-center gap-3 px-3 text-left transition-colors duration-100 hover:bg-panel-alt"
                        >
                          <span className="min-w-0 flex-1 truncate">{p.nombre}</span>
                          <span className="cifras text-sm text-tenue">
                            {pesos(p.precio)}{p.unidad === "kg" ? " / kg" : ""}
                          </span>
                          <Icono nombre="mas" tam={18} className="text-acento" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {porNombre.trim().length >= 2 && coincidencias.length === 0 && (
                  <p className="text-sm text-tenue">Nada con ese nombre en el catálogo.</p>
                )}
              </div>
            </Seccion>

            {aviso?.tipo === "noExiste" && (
              <Aviso
                tono="atencion"
                titulo={`El código ${aviso.codigo} no está en el catálogo`}
                accion={
                  <Boton tam="chico" icono="mas"
                    onClick={() => navigate(`/inventario?codigo=${encodeURIComponent(aviso.codigo)}`)}>
                    Crearlo en Inventario
                  </Boton>
                }
              >
                Créalo con su precio y vuelve a escanearlo aquí.
              </Aviso>
            )}
            {aviso?.tipo === "sinConexion" && (
              <Aviso tono="info" titulo="Sin conexión">
                El precio sale de la copia del catálogo guardada en este equipo.
              </Aviso>
            )}
            {aviso?.tipo === "error" && (
              <Aviso tono="error" titulo="No se pudo buscar el producto">{aviso.mensaje}</Aviso>
            )}
            {vaciadas && (
              <Aviso
                tono="info"
                titulo="Se vació la venta"
                accion={
                  <Boton tam="chico" onClick={() => { setLineas(vaciadas); setVaciadas(null); }}>
                    Deshacer
                  </Boton>
                }
              />
            )}

            <Seccion
              titulo="Productos de la venta"
              descripcion={lineas.length ? `${lineas.length} ${lineas.length === 1 ? "producto" : "productos"}` : undefined}
              accion={lineas.length > 0 && (
                <Boton tono="fantasma" tam="chico" icono="quitar"
                  onClick={() => { setVaciadas(lineas); setLineas([]); }}>
                  Vaciar
                </Boton>
              )}
              sinPadding
            >
              {lineas.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                  <Icono nombre="caja" tam={36} className="text-borde-fuerte" />
                  <p className="font-semibold">Todavía no hay productos</p>
                  <p className="max-w-[42ch] text-[15px] text-tenue">
                    Escanea el primero. Si pasas dos veces el mismo, se suma a la cantidad.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-borde">
                  {lineas.map((l) => (
                    <LineaVenta
                      key={l.producto.id}
                      linea={l}
                      onCantidad={(v) => cambiarCantidad(l.producto.id, v)}
                      onQuitar={() => quitar(l.producto.id)}
                    />
                  ))}
                </ul>
              )}
            </Seccion>
          </div>

          <div className="lg:sticky lg:top-6">
            <Seccion titulo="Cobro">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[15px] text-tenue">Total a cobrar</span>
                <span className="cifras text-[34px] font-semibold leading-none tracking-tight">{pesos(total)}</span>
              </div>

              <div className="mt-5 flex flex-col gap-4">
                <Segmentado etiqueta="¿Cómo paga?" opciones={PAGOS} valor={metodo} onCambio={setMetodo} apilado />

                {metodo === "efectivo" && (
                  <div className="flex flex-col gap-2">
                    <Campo
                      id="caja-recibido"
                      etiqueta="Recibido"
                      prefijo="$"
                      inputMode="numeric"
                      placeholder={total ? String(total) : "0"}
                      value={recibido}
                      onChange={(e) => setRecibido(soloDigitos(e.target.value))}
                      ayuda={recibido === "" ? "Opcional: sirve para calcular el cambio." : undefined}
                    />
                    {total > 0 && (
                      <div role="group" aria-label="Valores rápidos de efectivo" className="flex flex-wrap gap-2">
                        {billetesProbables(total).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setRecibido(String(v))}
                            aria-pressed={recibidoNum === v}
                            className="cifras min-h-11 rounded-pieza border-2 border-borde px-3 text-sm font-medium transition-colors duration-100 hover:border-borde-fuerte aria-pressed:border-acento aria-pressed:bg-acento-suave aria-pressed:text-acento"
                          >
                            {v === total ? "Exacto" : pesos(v)}
                          </button>
                        ))}
                      </div>
                    )}
                    {cambio !== null && cambio >= 0 && total > 0 && (
                      <p className="flex items-baseline justify-between rounded-pieza bg-acento-suave px-3.5 py-3">
                        <span className="font-semibold text-acento">Cambio</span>
                        <span className="cifras text-2xl font-semibold">{pesos(cambio)}</span>
                      </p>
                    )}
                  </div>
                )}

                {errorCobro && <Aviso tono="error" titulo="No se registró la venta">{errorCobro}</Aviso>}

                <Boton
                  tono="principal"
                  tam="grande"
                  icono="listo"
                  onClick={cobrar}
                  cargando={cobrando}
                  disabled={!puedeCobrar}
                  className="w-full"
                >
                  {total > 0 ? `Cobrar ${pesos(total)}` : "Cobrar"}
                </Boton>
                {porQueNo && !cobrando && <p className="-mt-2 text-center text-sm text-tenue">{porQueNo}</p>}
              </div>
            </Seccion>
          </div>
        </div>
      </Contenido>
    </>
  );
}

function LineaVenta({ linea, onCantidad, onQuitar }) {
  const p = linea.producto;
  const n = Number(linea.cantidad) || 0;
  const pasaStock = n > Number(p.existencia);

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
      <div className="min-w-0 flex-1 basis-44">
        <p className="truncate font-medium">{p.nombre}</p>
        <p className="cifras text-sm text-tenue">{pesos(p.precio)} {p.unidad === "kg" ? "/ kg" : "c/u"}</p>
        {pasaStock && (
          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-acento">
            <Icono nombre="alerta" tam={13} />
            En sistema hay {corta(p.existencia, p.unidad)}. Se vende igual.
          </p>
        )}
      </div>
      <div className="w-[10.5rem]">
        <Cantidad id={`cantidad-${p.id}`} valor={linea.cantidad} onCambio={onCantidad} unidad={p.unidad} compacto />
      </div>
      <p className="cifras w-24 text-right text-[17px] font-semibold">{pesos(subtotalDe(linea))}</p>
      <button
        type="button"
        onClick={onQuitar}
        aria-label={`Quitar ${p.nombre} de la venta`}
        className="flex h-11 w-11 items-center justify-center rounded-pieza text-tenue transition-colors duration-100 hover:bg-peligro-suave hover:text-peligro"
      >
        <Icono nombre="quitar" tam={19} />
      </button>
    </li>
  );
}

function Recibo({ recibo, onNueva }) {
  const { venta, alertas, enLinea } = recibo;
  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <section aria-labelledby="recibo-titulo" className="rounded-pieza border-2 border-ok bg-panel">
        <div className="flex items-center gap-3 border-b border-borde px-4 py-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ok-suave text-ok">
            <Icono nombre="listo" tam={24} />
          </span>
          <div>
            <h2 id="recibo-titulo" className="text-xl font-semibold">
              {enLinea ? "Venta registrada" : "Venta guardada sin conexión"}
            </h2>
            <p className="text-sm text-tenue">
              {hora(venta.creadoEn)} · {NOMBRE_PAGO[venta.metodoPago]}
              {!enLinea && " · se sube sola cuando vuelva la conexión"}
            </p>
          </div>
        </div>

        {/* Lo primero que necesita la cajera después de cobrar es el cambio. */}
        {venta.cambio !== null && venta.cambio !== undefined && (
          <div className="border-b border-borde bg-acento-suave px-4 py-4">
            <p className="text-sm font-semibold text-acento">Cambio para el cliente</p>
            <p className="cifras text-[40px] font-semibold leading-tight">{pesos(venta.cambio)}</p>
            <p className="cifras text-sm text-tenue">Recibido {pesos(venta.recibido)}</p>
          </div>
        )}

        <ul className="divide-y divide-borde px-4">
          {venta.lineas.map((l, i) => (
            <li key={i} className="flex items-baseline gap-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="block truncate">{l.nombre}</span>
                <span className="cifras text-sm text-tenue">
                  {corta(l.cantidad, l.unidad)} × {pesos(l.precioUnit)}
                </span>
              </span>
              <span className="cifras font-semibold">{pesos(l.subtotal)}</span>
            </li>
          ))}
        </ul>

        <div className="flex items-baseline justify-between border-t border-borde px-4 py-3.5">
          <span className="font-semibold">Total</span>
          <span className="cifras text-2xl font-semibold">{pesos(venta.total)}</span>
        </div>
      </section>

      {alertas?.length > 0 && (
        <Aviso tono="atencion" titulo="Revisa el inventario de estos productos">
          <ul className="mt-1 flex flex-col gap-0.5">
            {alertas.map((a) => (
              <li key={a.productoId}>
                <span className="font-medium">{a.nombre}</span>:{" "}
                {a.tipo === "negativo"
                  ? "el sistema quedó en negativo, conviene contarlo"
                  : a.tipo === "agotado"
                  ? "se agotó"
                  : `quedan ${num(a.existencia)} (el mínimo es ${num(a.stockMinimo)})`}
              </li>
            ))}
          </ul>
        </Aviso>
      )}

      <Boton tono="principal" tam="grande" icono="caja" onClick={onNueva} autoFocus className="w-full">
        Nueva venta
      </Boton>
    </div>
  );
}

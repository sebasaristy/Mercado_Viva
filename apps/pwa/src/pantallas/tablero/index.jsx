import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Contenido, Encabezado } from "../../componentes/Estructura.jsx";
import { Aviso, Boton, EstadoStock, Esqueleto, Seccion } from "../../componentes/ui.jsx";
import { Icono } from "../../componentes/Icono.jsx";
import { obtenerJson } from "../../api/cliente.js";
import { corta, haceCuanto, hora, num, pesos } from "../../lib/formato.js";
import { Columnas } from "./Columnas.jsx";

const CADA_MS = 15000;
const NOMBRE_PAGO = { efectivo: "Efectivo", tarjeta: "Tarjeta", transferencia: "Transferencia" };

const etiquetaHora = (h) => `${((h + 11) % 12) + 1} ${h % 24 < 12 ? "a. m." : "p. m."}`;

// El tablero responde, en este orden, lo que un dueño de tienda se pregunta:
// ¿cómo voy hoy?, ¿qué me va a faltar?, ¿a qué hora vendo?, ¿qué se vende y qué
// no?, ¿cuánta plata tengo parada en la estantería?
export function Tablero() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [, setReloj] = useState(0);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setDatos(await obtenerJson("/tablero/resumen"));
      setError(null);
    } catch (e) {
      setError(e);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const refresco = setInterval(() => {
      if (document.visibilityState === "visible") cargar();
    }, CADA_MS);
    const reloj = setInterval(() => setReloj((n) => n + 1), 5000);
    return () => {
      clearInterval(refresco);
      clearInterval(reloj);
    };
  }, [cargar]);

  const encabezado = (
    <Encabezado
      titulo="Tablero"
      descripcion="Cómo va el día: ventas, ganancia, qué pedir y qué no se está vendiendo. Se actualiza solo."
      accion={
        <div className="flex items-center gap-3">
          {datos && (
            <span className="text-sm text-tenue" aria-live="polite">
              Actualizado {haceCuanto(datos.generadoEn)}
            </span>
          )}
          <Boton tam="chico" icono="recargar" onClick={cargar} cargando={cargando && Boolean(datos)}>
            Actualizar
          </Boton>
        </div>
      }
    />
  );

  if (!datos && cargando) {
    return (
      <>
        {encabezado}
        <Contenido>
          <div aria-hidden="true" className="flex flex-col gap-5">
            <div className="grid gap-px overflow-hidden rounded-pieza border border-borde bg-borde sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex flex-col gap-3 bg-panel p-5">
                  <Esqueleto className="h-4 w-24" />
                  <Esqueleto className={i === 0 ? "h-12 w-48" : "h-8 w-28"} />
                  <Esqueleto className="h-3 w-32" />
                </div>
              ))}
            </div>
            <Esqueleto className="h-56 w-full" />
            <div className="grid gap-5 lg:grid-cols-2">
              <Esqueleto className="h-72 w-full" />
              <Esqueleto className="h-72 w-full" />
            </div>
          </div>
        </Contenido>
      </>
    );
  }

  if (!datos && error) {
    const faltanFunciones = /resumen_tablero|function|funci/i.test(`${error.causa ?? ""} ${error.message}`);
    return (
      <>
        {encabezado}
        <Contenido>
          <Aviso
            tono="error"
            titulo="No se pudo cargar el tablero"
            accion={<Boton tam="chico" icono="recargar" onClick={cargar}>Reintentar</Boton>}
          >
            <p>{error.message}</p>
            {faltanFunciones && (
              <p className="mt-1">
                Parece que faltan las funciones en Supabase: corre <span className="cifras">npm run db:sql</span> y
                pega <span className="cifras">db/aplicar_en_supabase.sql</span> en el editor SQL.
              </p>
            )}
            {error.deRed && (
              <p className="mt-1">
                Revisa que la API esté corriendo (<span className="cifras">npm run dev</span> o{" "}
                <span className="cifras">npm run dev:local</span>).
              </p>
            )}
            {error.causa && <p className="cifras mt-1 text-xs text-tenue">{error.causa}</p>}
          </Aviso>
        </Contenido>
      </>
    );
  }

  const { hoy, ayer, comparacion } = datos;

  const horaActual = new Date().getHours();
  const horasConVentas = datos.porHora.filter((h) => h.ventas > 0).map((h) => h.hora);
  const desde = Math.min(6, ...horasConVentas);
  const hasta = Math.max(21, ...horasConVentas);
  const puntosHora = datos.porHora
    .filter((h) => h.hora >= desde && h.hora <= hasta)
    .map((h) => ({
      clave: h.hora,
      etiqueta: `${etiquetaHora(h.hora)} a ${etiquetaHora(h.hora + 1)}`,
      etiquetaCorta: h.hora % 3 === 0 ? etiquetaHora(h.hora) : "",
      valor: Number(h.ventas)
    }));
  const iHoraActual = puntosHora.findIndex((p) => p.clave === horaActual);
  const iPico = puntosHora.reduce((m, p, i) => (p.valor > (puntosHora[m]?.valor ?? 0) ? i : m), 0);

  const puntosDia = datos.ultimos7Dias.map((d, i, lista) => {
    const fecha = new Date(`${d.fecha}T12:00:00`);
    const esHoy = i === lista.length - 1;
    return {
      clave: d.fecha,
      etiqueta: esHoy
        ? "Hoy (hasta ahora)"
        : fecha.toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "short" }),
      etiquetaCorta: esHoy ? "Hoy" : fecha.toLocaleDateString("es-CO", { weekday: "short" }).replace(".", ""),
      valor: Number(d.ventas)
    };
  });
  const iDiaPico = puntosDia.reduce((m, p, i) => (p.valor > (puntosDia[m]?.valor ?? 0) ? i : m), 0);
  const diasAnteriores = puntosDia.slice(0, -1);
  const promedioDiario = diasAnteriores.length
    ? diasAnteriores.reduce((s, p) => s + p.valor, 0) / diasAnteriores.length
    : 0;

  return (
    <>
      {encabezado}
      <Contenido>
        <div className={`flex flex-col gap-5 transition-opacity duration-200 ${cargando ? "opacity-70" : ""}`}>
          {error && (
            <Aviso tono="atencion" titulo="No se pudo actualizar">
              Se muestran los datos de {haceCuanto(datos.generadoEn)}. {error.message}
            </Aviso>
          )}

          {/* ¿Cómo voy hoy? */}
          <section
            aria-label="Resumen de hoy"
            className="grid gap-px overflow-hidden rounded-pieza border border-borde bg-borde sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]"
          >
            <div className="flex flex-col gap-2 bg-panel p-5 sm:col-span-2 lg:col-span-1">
              <p className="text-sm font-semibold text-tenue">Ventas de hoy</p>
              <p className="text-[clamp(38px,7vw,52px)] font-semibold leading-none tracking-tight">{pesos(hoy.ventas)}</p>
              <Variacion pct={comparacion.variacionPct} referencia={comparacion.referencia} />
            </div>
            <Indicador
              etiqueta="Ganancia bruta"
              valor={pesos(hoy.ganancia)}
              detalle={hoy.margenPct != null ? `Margen del ${num(hoy.margenPct)} %` : "Sin ventas todavía"}
              ayuda="Lo vendido menos lo que costó"
            />
            <Indicador
              etiqueta="Ticket promedio"
              valor={pesos(hoy.ticketPromedio)}
              detalle={`${num(hoy.transacciones)} ${hoy.transacciones === 1 ? "venta" : "ventas"}`}
              ayuda="Cuánto compra cada cliente"
            />
            {/* Kilos y unidades por separado: sumarlos daba "107,5", que no significa nada. */}
            <Indicador
              etiqueta="Vendido hoy"
              valor={`${num(hoy.unidades)} und`}
              detalle={hoy.kilos > 0 ? `y ${num(hoy.kilos)} kg de productos por peso` : "Nada por peso todavía"}
              ayuda={`Ayer, el día completo: ${pesos(ayer.ventas)}`}
            />
          </section>

          {/* ¿Qué me va a faltar? */}
          <Seccion
            titulo="Qué pedir"
            descripcion="Agotados y productos que alcanzan para menos de 3 días, según lo vendido en las últimas 2 semanas. Un agotado es una venta que se va a la tienda de enfrente."
            accion={
              <Link
                to="/inventario"
                className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pieza border-2 border-borde-fuerte px-3 text-sm font-semibold hover:bg-panel-alt"
              >
                <Icono nombre="inventario" tam={16} />
                Inventario
              </Link>
            }
            sinPadding
          >
            {datos.reabastecer.length === 0 ? (
              <p className="flex items-center gap-2 px-4 py-6 text-[15px] text-tenue">
                <Icono nombre="listo" tam={18} className="text-ok" />
                Nada urgente: todo alcanza para más de 3 días.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px] text-[15px]">
                  <thead>
                    <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-tenue">
                      <th scope="col" className="px-4 py-2.5 font-semibold">Producto</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Quedan</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Alcanza para</th>
                      <th scope="col" className="px-3 py-2.5 text-right font-semibold">Pedir</th>
                      <th scope="col" className="px-4 py-2.5 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-borde">
                    {datos.reabastecer.map((r) => (
                      <tr key={r.productoId}>
                        <td className="px-4 py-2.5 font-medium">{r.nombre}</td>
                        <td className="cifras px-3 py-2.5 text-right">{corta(r.existencia, r.unidad)}</td>
                        <td className="cifras px-3 py-2.5 text-right">
                          {r.existencia <= 0
                            ? <span className="font-sans font-semibold">ya no hay</span>
                            : r.diasCobertura == null
                            ? <span className="font-sans text-tenue">sin ventas</span>
                            : r.diasCobertura < 1
                            ? "menos de 1 día"
                            : `${num(r.diasCobertura)} días`}
                        </td>
                        <td className="cifras px-3 py-2.5 text-right font-semibold">
                          {r.sugeridoPedir > 0 ? corta(r.sugeridoPedir, r.unidad) : "—"}
                        </td>
                        <td className="px-4 py-2.5"><EstadoStock estado={r.estado} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="border-t border-borde px-4 py-2.5 text-sm text-tenue">
                  «Pedir» cubre una semana de venta más el mínimo de cada producto.
                </p>
              </div>
            )}
          </Seccion>

          {/* ¿A qué hora vendo? */}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <Seccion
              titulo="Ventas por hora, hoy"
              descripcion={
                puntosHora[iPico]?.valor > 0
                  ? `La hora más fuerte va siendo ${puntosHora[iPico].etiqueta}: ${pesos(puntosHora[iPico].valor)}. Úsalo para decidir cuántas cajas abrir.`
                  : "Aquí aparece a qué hora se vende más, para saber cuántas cajas abrir."
              }
            >
              <Columnas
                titulo="Ventas por hora, hoy"
                puntos={puntosHora}
                destacado={iHoraActual}
                etiquetar={[iPico]}
                formatoValor={pesos}
              />
            </Seccion>
            <Seccion
              titulo="Últimos 7 días"
              descripcion={
                promedioDiario > 0
                  ? `Promedio diario de los 6 días anteriores: ${pesos(promedioDiario)}.`
                  : "Ventas de cada día de la última semana."
              }
            >
              <Columnas
                titulo="Ventas de los últimos 7 días"
                puntos={puntosDia}
                destacado={puntosDia.length - 1}
                etiquetar={[...new Set([iDiaPico, puntosDia.length - 1])]}
                formatoValor={pesos}
              />
            </Seccion>
          </div>

          {/* ¿Qué se vende y qué no? */}
          <div className="grid gap-5 lg:grid-cols-2">
            <Seccion titulo="Lo que más se vende" descripcion="Últimos 7 días, por plata que entra." sinPadding>
              {datos.top.length === 0 ? (
                <p className="px-4 py-6 text-[15px] text-tenue">Todavía no hay ventas en la semana.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-[15px]">
                    <thead>
                      <tr className="border-b border-borde text-left text-xs uppercase tracking-wide text-tenue">
                        <th scope="col" className="px-4 py-2.5 font-semibold">Producto</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-semibold">Vendido</th>
                        <th scope="col" className="px-3 py-2.5 text-right font-semibold">Ingreso</th>
                        <th scope="col" className="px-4 py-2.5 text-right font-semibold">Ganancia</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-borde">
                      {datos.top.map((t) => (
                        <tr key={t.productoId}>
                          <td className="px-4 py-2.5 font-medium">{t.nombre}</td>
                          <td className="cifras px-3 py-2.5 text-right">{corta(t.unidades, t.unidad)}</td>
                          <td className="cifras px-3 py-2.5 text-right">{pesos(t.ingreso)}</td>
                          <td className="cifras px-4 py-2.5 text-right">{pesos(t.ganancia)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Seccion>

            <Seccion
              titulo="Plata quieta"
              descripcion="Con stock y sin una sola venta en 14 días. Es capital parado: sácalo en promoción o no lo vuelvas a pedir."
              sinPadding
            >
              {datos.quietos.length === 0 ? (
                <p className="flex items-center gap-2 px-4 py-6 text-[15px] text-tenue">
                  <Icono nombre="listo" tam={18} className="text-ok" />
                  Todo lo que tiene stock se vendió en las últimas 2 semanas.
                </p>
              ) : (
                <>
                  <p className="border-b border-borde px-4 py-3 text-[15px]">
                    <span className="text-tenue">Parado a precio de costo: </span>
                    <span className="cifras font-semibold">
                      {pesos(datos.quietos.reduce((s, q) => s + Number(q.valorCosto), 0))}
                    </span>
                  </p>
                  <ul className="divide-y divide-borde">
                    {datos.quietos.map((q) => (
                      <li key={q.productoId} className="flex items-baseline gap-3 px-4 py-2.5">
                        <span className="min-w-0 flex-1 truncate font-medium">{q.nombre}</span>
                        <span className="cifras text-sm text-tenue">{num(q.existencia)} en stock</span>
                        <span className="cifras w-28 text-right">{pesos(q.valorCosto)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Seccion>
          </div>

          {/* Plata en la estantería, lo que se pierde y cómo pagan */}
          <div className="grid gap-5 md:grid-cols-3">
            <Seccion titulo="Inventario">
              <p className="text-[28px] font-semibold leading-none">{pesos(datos.inventario.valorCosto)}</p>
              <p className="mt-1.5 text-sm text-tenue">en mercancía, a precio de costo</p>
              <dl className="mt-4 flex flex-col gap-1.5 border-t border-borde pt-3 text-[15px]">
                <Dato etiqueta="Si se vende todo" valor={pesos(datos.inventario.valorVenta)} />
                <Dato
                  etiqueta="Ganancia posible"
                  valor={pesos(datos.inventario.valorVenta - datos.inventario.valorCosto)}
                />
                <Dato
                  etiqueta="Agotados · bajos"
                  valor={`${num(datos.inventario.agotados)} · ${num(datos.inventario.bajos)}`}
                />
              </dl>
            </Seccion>

            <Seccion titulo="Merma de la semana">
              <p className="text-[28px] font-semibold leading-none">{pesos(datos.merma7d.valorCosto)}</p>
              <p className="mt-1.5 text-sm text-tenue">perdidos a precio de costo</p>
              <p className="mt-4 border-t border-borde pt-3 text-[15px] text-tenue">
                {datos.merma7d.registros > 0
                  ? `${num(datos.merma7d.registros)} ${datos.merma7d.registros === 1 ? "registro" : "registros"}: vencidos, dañados o robados. Si sube, revisa la rotación de los perecederos.`
                  : "Sin merma registrada en 7 días. Si nunca se registra, probablemente no se está anotando."}
              </p>
            </Seccion>

            <Seccion titulo="Cómo pagan hoy">
              {datos.metodosPago.length === 0 ? (
                <p className="text-[15px] text-tenue">Todavía no hay ventas hoy.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {datos.metodosPago.map((m) => (
                    <li key={m.metodo} className="flex items-center gap-3">
                      <Icono nombre={m.metodo} tam={20} className="text-tenue" />
                      <span className="flex-1">
                        <span className="block font-medium leading-tight">{NOMBRE_PAGO[m.metodo]}</span>
                        <span className="text-sm text-tenue">
                          {num(m.transacciones)} {m.transacciones === 1 ? "venta" : "ventas"}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="cifras block leading-tight">{pesos(m.ventas)}</span>
                        <span className="cifras text-sm text-tenue">
                          {hoy.ventas > 0 ? `${num(Math.round((m.ventas / hoy.ventas) * 100))} %` : ""}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Seccion>
          </div>

          <Seccion titulo="Últimas ventas" sinPadding>
            {datos.ultimasVentas.length === 0 ? (
              <p className="px-4 py-6 text-[15px] text-tenue">
                Cuando se cobre en la caja, las ventas aparecen aquí en segundos.
              </p>
            ) : (
              <ul className="divide-y divide-borde">
                {datos.ultimasVentas.map((v) => (
                  <li key={v.id} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="cifras w-20 text-sm text-tenue">{hora(v.creadoEn)}</span>
                    <span className="flex-1 text-[15px]">
                      {num(v.productos)} {Number(v.productos) === 1 ? "producto" : "productos"} · {NOMBRE_PAGO[v.metodoPago]}
                    </span>
                    <span className="cifras font-semibold">{pesos(v.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Seccion>
        </div>
      </Contenido>
    </>
  );
}

function Indicador({ etiqueta, valor, detalle, ayuda }) {
  return (
    <div className="flex flex-col gap-2 bg-panel p-5">
      <p className="text-sm font-semibold text-tenue">{etiqueta}</p>
      <p className="text-[28px] font-semibold leading-none tracking-tight">{valor}</p>
      {detalle && <p className="text-sm text-tinta">{detalle}</p>}
      {ayuda && <p className="text-xs text-tenue">{ayuda}</p>}
    </div>
  );
}

// Subir en ventas es bueno: verde con flecha arriba. Nunca solo el color.
function Variacion({ pct, referencia }) {
  if (pct === null || pct === undefined) {
    return <p className="text-sm text-tenue">Ayer a esta hora no había ventas para comparar.</p>;
  }
  const sube = pct >= 0;
  return (
    <p className="flex flex-wrap items-center gap-x-1.5 text-sm">
      <span className={`inline-flex items-center gap-1 font-semibold ${sube ? "text-ok" : "text-peligro"}`}>
        <Icono nombre={sube ? "sube" : "baja"} tam={16} />
        {sube ? "+" : "−"}{num(Math.abs(pct))} %
      </span>
      <span className="text-tenue">vs. ayer a esta hora ({pesos(referencia)})</span>
    </p>
  );
}

function Dato({ etiqueta, valor }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-tenue">{etiqueta}</dt>
      <dd className="cifras m-0">{valor}</dd>
    </div>
  );
}

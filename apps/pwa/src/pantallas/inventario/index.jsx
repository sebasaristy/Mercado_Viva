import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Contenido, Encabezado } from "../../componentes/Estructura.jsx";
import { LectorCodigo } from "../../componentes/LectorCodigo.jsx";
import { Aviso, Boton, EstadoStock, Esqueleto, Seccion } from "../../componentes/ui.jsx";
import { Icono } from "../../componentes/Icono.jsx";
import { buscarProducto } from "../../local/operar.js";
import { productosEnCache, refrescarCatalogo } from "../../local/catalogo.js";
import { corta, pesos } from "../../lib/formato.js";
import { FichaProducto } from "./FichaProducto.jsx";
import { NuevoProducto } from "./NuevoProducto.jsx";

// Una sola acción a la vez en la columna de la izquierda: escanear, y según lo
// que aparezca, registrar o crear. A la derecha, el catálogo para mirar.
export function Inventario() {
  const [params, setParams] = useSearchParams();
  const [vista, setVista] = useState({ tipo: "inicio" });
  const [catalogo, setCatalogo] = useState({ estado: "cargando", productos: [] });
  const [busqueda, setBusqueda] = useState("");
  const [soloPorPedir, setSoloPorPedir] = useState(false);

  const cargarCatalogo = useCallback(async () => {
    setCatalogo((c) => ({ ...c, estado: c.productos.length ? "actualizando" : "cargando" }));
    try {
      setCatalogo({ estado: "listo", productos: await refrescarCatalogo() });
    } catch (e) {
      const productos = await productosEnCache();
      setCatalogo({ estado: productos.length ? "sin-conexion" : "error", productos, mensaje: e.message });
    }
  }, []);

  useEffect(() => {
    cargarCatalogo();
  }, [cargarCatalogo]);

  const leerCodigo = useCallback(async (codigo) => {
    setVista({ tipo: "buscando", codigo });
    try {
      const r = await buscarProducto(codigo);
      setVista(r.producto
        ? { tipo: "producto", producto: r.producto, pesoKg: r.pesoKg }
        : { tipo: "nuevo", codigo: r.codigo, pesoKg: r.pesoKg, sinConexion: !r.enLinea });
    } catch (e) {
      setVista({ tipo: "error", mensaje: e.message, causa: e.causa });
    }
  }, []);

  // La caja manda aquí los códigos que no encontró, para crearlos.
  useEffect(() => {
    const codigo = params.get("codigo");
    if (codigo) {
      setParams({}, { replace: true });
      leerCodigo(codigo);
    }
  }, [params, setParams, leerCodigo]);

  const alActualizar = useCallback((producto) => {
    setCatalogo((c) => {
      const yaEstaba = c.productos.some((p) => p.id === producto.id);
      const productos = yaEstaba
        ? c.productos.map((p) => (p.id === producto.id ? producto : p))
        : [...c.productos, producto].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
      return { ...c, productos };
    });
    setVista({ tipo: "producto", producto });
  }, []);

  const porPedir = useMemo(
    () => catalogo.productos.filter((p) => p.estado !== "ok"),
    [catalogo.productos]
  );

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return (soloPorPedir ? porPedir : catalogo.productos).filter(
      (p) => !q || p.nombre.toLowerCase().includes(q) || (p.codigoBarras ?? "").includes(q)
    );
  }, [catalogo.productos, porPedir, busqueda, soloPorPedir]);

  const seleccionado = vista.tipo === "producto" ? vista.producto.id : null;

  return (
    <>
      <Encabezado
        titulo="Inventario"
        descripcion="Escanea un producto para registrar lo que llegó o lo que se perdió. Si el código no existe, lo creas aquí mismo."
      />
      <Contenido>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,460px)_minmax(0,1fr)] lg:items-start">
          <div className="flex min-w-0 flex-col gap-4">
            <Seccion>
              <LectorCodigo onCodigo={leerCodigo} ocupado={vista.tipo === "buscando"} />
            </Seccion>

            {vista.tipo === "inicio" && (
              <ComoFunciona onSinCodigo={() => setVista({ tipo: "nuevo", codigo: null })} />
            )}

            {vista.tipo === "buscando" && (
              <Seccion>
                <p role="status" className="sr-only">Buscando {vista.codigo}</p>
                <div className="flex flex-col gap-3">
                  <Esqueleto className="h-6 w-2/3" />
                  <Esqueleto className="h-4 w-1/3" />
                  <Esqueleto className="h-24 w-full" />
                </div>
              </Seccion>
            )}

            {vista.tipo === "error" && (
              <Aviso
                tono="error"
                titulo="No se pudo buscar el producto"
                accion={<Boton tam="chico" onClick={() => setVista({ tipo: "inicio" })}>Entendido</Boton>}
              >
                {vista.mensaje}
                {vista.causa && <span className="cifras mt-1 block text-xs text-tenue">{vista.causa}</span>}
              </Aviso>
            )}

            {vista.tipo === "producto" && (
              <FichaProducto
                key={`${vista.producto.id}:${vista.pesoKg ?? ""}`}
                producto={vista.producto}
                pesoKg={vista.pesoKg}
                onActualizado={alActualizar}
                onCerrar={() => setVista({ tipo: "inicio" })}
              />
            )}

            {vista.tipo === "nuevo" && (
              <>
                {vista.sinConexion && (
                  <Aviso tono="atencion" titulo="Sin conexión">
                    No se pudo confirmar si ese código ya existe. Puedes crearlo igual: se revisa cuando suba.
                  </Aviso>
                )}
                <NuevoProducto
                  key={vista.codigo ?? "sin-codigo"}
                  codigo={vista.codigo}
                  pesoKg={vista.pesoKg}
                  onCreado={alActualizar}
                  onCancelar={() => setVista({ tipo: "inicio" })}
                  onVerExistente={(p) => setVista({ tipo: "producto", producto: p })}
                />
              </>
            )}
          </div>

          <Seccion
            titulo="Productos"
            descripcion={
              catalogo.estado === "sin-conexion"
                ? "Copia guardada en este equipo: sin conexión con el servidor"
                : `${catalogo.productos.length} en el catálogo`
            }
            accion={
              <Boton tono="fantasma" tam="chico" icono="recargar" onClick={cargarCatalogo}
                cargando={catalogo.estado === "actualizando"}>
                Actualizar
              </Boton>
            }
            sinPadding
          >
            <div className="flex flex-col gap-3 border-b border-borde p-4 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <label htmlFor="buscar-producto" className="sr-only">Buscar producto</label>
                <Icono nombre="buscar" tam={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tenue" />
                <input
                  id="buscar-producto"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar por nombre o código"
                  autoComplete="off"
                  className="min-h-11 w-full rounded-pieza border-2 border-borde bg-panel pl-10 pr-3 text-[16px] placeholder:text-tenue/70 focus:border-acento"
                />
              </div>
              <div role="group" aria-label="Filtrar productos" className="flex gap-2">
                <Filtro activo={!soloPorPedir} onClick={() => setSoloPorPedir(false)}>Todos</Filtro>
                <Filtro activo={soloPorPedir} onClick={() => setSoloPorPedir(true)}>
                  Por pedir <span className="cifras">{porPedir.length}</span>
                </Filtro>
              </div>
            </div>

            {catalogo.estado === "cargando" && (
              <ul aria-hidden="true" className="divide-y divide-borde">
                {[0, 1, 2, 3, 4].map((i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3.5">
                    <div className="flex flex-1 flex-col gap-2">
                      <Esqueleto className="h-4 w-1/2" />
                      <Esqueleto className="h-3 w-1/4" />
                    </div>
                    <Esqueleto className="h-5 w-16" />
                  </li>
                ))}
              </ul>
            )}

            {catalogo.estado === "error" && (
              <div className="p-4">
                <Aviso
                  tono="error"
                  titulo="No se pudo cargar el catálogo"
                  accion={<Boton tam="chico" icono="recargar" onClick={cargarCatalogo}>Reintentar</Boton>}
                >
                  Revisa que la API esté corriendo: <span className="cifras">npm run dev</span> con Supabase,
                  o <span className="cifras">npm run dev:local</span> para probar sin nada configurado.
                </Aviso>
              </div>
            )}

            {catalogo.estado !== "cargando" && catalogo.estado !== "error" && visibles.length === 0 && (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <Icono nombre="inventario" tam={36} className="text-borde-fuerte" />
                <p className="font-semibold">
                  {catalogo.productos.length === 0
                    ? "Todavía no hay productos"
                    : soloPorPedir
                    ? "Nada por pedir"
                    : "Nada coincide con la búsqueda"}
                </p>
                <p className="max-w-[40ch] text-[15px] text-tenue">
                  {catalogo.productos.length === 0
                    ? "Escanea el primero: si no existe, lo creas en ese mismo paso."
                    : soloPorPedir
                    ? "Todos los productos tienen más stock que su mínimo."
                    : "Prueba con otra palabra o escanea el código."}
                </p>
              </div>
            )}

            {visibles.length > 0 && (
              <ul className="divide-y divide-borde">
                {visibles.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => setVista({ tipo: "producto", producto: p })}
                      aria-current={seleccionado === p.id ? "true" : undefined}
                      className={
                        "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors duration-100 hover:bg-panel-alt " +
                        (seleccionado === p.id ? "bg-acento-suave/70" : "")
                      }
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[16px] font-medium">{p.nombre}</p>
                        <p className="truncate text-sm text-tenue">
                          {p.categoria} · <span className="cifras">{pesos(p.precio)}</span>
                          {p.unidad === "kg" ? " / kg" : ""}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="cifras text-[16px] font-semibold">{corta(p.existencia, p.unidad)}</span>
                        <EstadoStock estado={p.estado} />
                      </div>
                    </button>
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

function Filtro({ activo, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={
        "inline-flex min-h-11 items-center gap-1.5 rounded-pieza border-2 px-3 text-[15px] font-semibold transition-colors duration-100 " +
        (activo
          ? "border-acento bg-acento-suave text-acento"
          : "border-borde bg-panel text-tenue hover:border-borde-fuerte hover:text-tinta")
      }
    >
      {children}
    </button>
  );
}

function ComoFunciona({ onSinCodigo }) {
  const pasos = [
    ["Escanea el código", "Con el lector, con la cámara, o escribiéndolo y tocando Buscar."],
    ["Si el producto existe", "Eliges si llegó mercancía o si se perdió, y cuánto."],
    ["Si no existe", "Lo creas con su precio, su costo y lo que llegó. Queda listo para vender en la caja."]
  ];
  return (
    <Seccion titulo="Cómo funciona">
      <ol className="flex flex-col gap-3">
        {pasos.map(([titulo, detalle], i) => (
          <li key={titulo} className="flex gap-3">
            <span className="cifras flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-acento-suave text-sm font-semibold text-acento">
              {i + 1}
            </span>
            <div>
              <p className="font-semibold leading-snug">{titulo}</p>
              <p className="text-[15px] text-tenue">{detalle}</p>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 border-t border-borde pt-4">
        <Boton icono="mas" onClick={onSinCodigo} className="w-full">Crear un producto sin código</Boton>
      </div>
    </Seccion>
  );
}

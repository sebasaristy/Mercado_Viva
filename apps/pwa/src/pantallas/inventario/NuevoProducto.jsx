import { useState } from "react";
import { Aviso, Boton, Campo, Cantidad, Chips, Segmentado } from "../../componentes/ui.jsx";
import { avisar } from "../../componentes/Avisos.jsx";
import { ejecutar } from "../../local/operar.js";
import { guardarEnCache } from "../../local/catalogo.js";
import { conUnidad, margen, num, pesos, soloDigitos } from "../../lib/formato.js";

const CATEGORIAS = ["Abarrotes", "Lácteos", "Bebidas", "Frutas", "Verduras", "Carnes", "Panadería", "Aseo", "Otros"];

// Un código que no existe no es un callejón sin salida: se crea el producto
// aquí mismo y, si llegó mercancía, entra en el mismo paso.
export function NuevoProducto({ codigo, pesoKg, onCreado, onCancelar, onVerExistente }) {
  const [f, setF] = useState({
    nombre: "",
    categoria: "",
    unidad: pesoKg ? "kg" : "unidad",
    precio: "",
    costo: "",
    cantidadInicial: pesoKg ? String(pesoKg) : "",
    stockMinimo: ""
  });
  const [errores, setErrores] = useState({});
  const [errorGeneral, setErrorGeneral] = useState(null);
  const [duplicado, setDuplicado] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const poner = (campo) => (valor) => {
    setF((x) => ({ ...x, [campo]: valor }));
    setErrores((e) => ({ ...e, [campo]: null }));
  };

  const m = margen(f.precio, f.costo);
  const inicial = Number(f.cantidadInicial || 0);

  function validar() {
    const e = {};
    if (f.nombre.trim().length < 2) e.nombre = "Escribe el nombre del producto.";
    if (!f.categoria) e.categoria = "Elige una categoría.";
    if (!(Number(f.precio) > 0)) e.precio = "Escribe el precio de venta.";
    if (!(inicial >= 0)) e.cantidadInicial = "La cantidad no es válida.";
    else if (f.unidad === "unidad" && !Number.isInteger(inicial)) {
      e.cantidadInicial = "Por unidad no lleva decimales.";
    }
    setErrores(e);
    return Object.keys(e).length === 0;
  }

  async function crear(ev) {
    ev.preventDefault();
    if (!validar()) return;

    setGuardando(true);
    setErrorGeneral(null);
    setDuplicado(null);

    const cuerpo = {
      codigo: codigo || null,
      nombre: f.nombre.trim(),
      categoria: f.categoria,
      unidad: f.unidad,
      precio: Number(f.precio),
      costo: Number(f.costo || 0),
      stockMinimo: Number(f.stockMinimo || 0),
      cantidadInicial: inicial
    };

    try {
      const r = await ejecutar("/catalogo/productos", cuerpo);
      const producto = r.enLinea
        ? r.datos.producto
        : {
            id: r.id,
            codigoBarras: cuerpo.codigo,
            ...cuerpo,
            existencia: inicial,
            estado: inicial <= 0 ? "agotado" : inicial <= cuerpo.stockMinimo ? "bajo" : "ok"
          };

      await guardarEnCache(producto);
      onCreado(producto);
      avisar({
        tono: r.enLinea ? "exito" : "atencion",
        titulo: `Creaste «${producto.nombre}»`,
        texto: !r.enLinea
          ? "Sin conexión: se sube solo cuando vuelva."
          : inicial > 0
          ? `Entró con ${conUnidad(inicial, cuerpo.unidad)}. Ya se puede vender.`
          : "Todavía sin stock: ingrésalo cuando llegue la mercancía."
      });
    } catch (e) {
      if (e.codigo === "codigo_duplicado") setDuplicado(e.detalle?.producto ?? null);
      else if (e.campo) setErrores((x) => ({ ...x, [e.campo]: e.message }));
      else setErrorGeneral(e.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={crear} noValidate aria-labelledby="nuevo-titulo" className="rounded-pieza border border-borde bg-panel">
      <div className="border-b border-borde px-4 py-3.5">
        <h2 id="nuevo-titulo" className="text-xl font-semibold leading-tight">Producto nuevo</h2>
        <p className="mt-1 text-[15px] text-tenue">
          {codigo ? (
            <>El código <span className="cifras font-semibold text-tinta">{codigo}</span> no está en el catálogo. Créalo y queda listo para vender.</>
          ) : (
            "Para lo que no tiene código de barras, como lo que se vende a granel."
          )}
        </p>
      </div>

      <div className="flex flex-col gap-4 p-4">
        {duplicado && (
          <Aviso
            tono="atencion"
            titulo={`Ese código ya es de «${duplicado.nombre}»`}
            accion={<Boton tam="chico" onClick={() => onVerExistente(duplicado)}>Ver ese producto</Boton>}
          >
            No se creó otro, para no duplicar el inventario.
          </Aviso>
        )}

        <Campo
          id="nuevo-nombre"
          etiqueta="Nombre"
          placeholder="Ej: Arroz Diana 500 g"
          value={f.nombre}
          onChange={(e) => poner("nombre")(e.target.value)}
          error={errores.nombre}
          autoComplete="off"
          autoFocus
        />

        <Chips
          etiqueta="Categoría"
          opciones={CATEGORIAS}
          valor={f.categoria}
          onCambio={poner("categoria")}
          error={errores.categoria}
        />

        <Segmentado
          etiqueta="¿Cómo se vende?"
          valor={f.unidad}
          onCambio={poner("unidad")}
          opciones={[
            { valor: "unidad", texto: "Por unidad" },
            { valor: "kg", texto: "Por kilo" }
          ]}
        />

        <div className="grid grid-cols-2 gap-3">
          <Campo
            id="nuevo-precio"
            etiqueta={f.unidad === "kg" ? "Precio por kilo" : "Precio de venta"}
            prefijo="$"
            inputMode="numeric"
            placeholder="3200"
            value={f.precio}
            onChange={(e) => poner("precio")(soloDigitos(e.target.value))}
            error={errores.precio}
          />
          <Campo
            id="nuevo-costo"
            etiqueta="Lo que te cuesta"
            prefijo="$"
            inputMode="numeric"
            placeholder="2400"
            value={f.costo}
            onChange={(e) => poner("costo")(soloDigitos(e.target.value))}
            ayuda="Opcional"
          />
        </div>

        {m && (
          <p className={`rounded-pieza px-3.5 py-2.5 text-[15px] ${m.valor < 0 && Number(f.costo) > 0 ? "bg-peligro-suave text-peligro" : "bg-panel-alt text-tinta"}`}>
            {Number(f.costo) <= 0
              ? "Pon el costo para ver cuánto ganas en cada venta."
              : m.valor < 0
              ? `Estarías vendiendo ${pesos(-m.valor)} por debajo del costo.`
              : <>Ganas <strong className="cifras">{pesos(m.valor)}</strong> {f.unidad === "kg" ? "por kilo" : "por unidad"} · margen <strong className="cifras">{num(m.pct)} %</strong></>}
          </p>
        )}

        <Cantidad
          id="nuevo-cantidad"
          etiqueta="¿Cuánto entra ahora?"
          valor={f.cantidadInicial}
          onCambio={poner("cantidadInicial")}
          unidad={f.unidad}
        />
        {errores.cantidadInicial && (
          <p role="alert" className="-mt-2 text-sm font-medium text-peligro">{errores.cantidadInicial}</p>
        )}

        <Campo
          id="nuevo-minimo"
          etiqueta="Avisar cuando queden menos de"
          inputMode="decimal"
          sufijo={f.unidad === "kg" ? "kg" : "und"}
          placeholder="10"
          value={f.stockMinimo}
          onChange={(e) => poner("stockMinimo")(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
          ayuda="Con esto el tablero te dice cuándo pedir."
        />

        {errorGeneral && <Aviso tono="error" titulo="No se creó el producto">{errorGeneral}</Aviso>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Boton tono="secundario" tam="grande" onClick={onCancelar} className="sm:w-36">Cancelar</Boton>
          <Boton type="submit" tono="principal" tam="grande" icono="listo" cargando={guardando} className="flex-1">
            {inicial > 0 ? `Crear e ingresar ${conUnidad(inicial, f.unidad)}` : "Crear producto"}
          </Boton>
        </div>
      </div>
    </form>
  );
}

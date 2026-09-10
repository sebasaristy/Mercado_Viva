import { useState, useRef } from "react";
import { validarCantidad } from "@mv/compartido";
import { Marco, Fila, Vacio } from "../../componentes/Marco.jsx";
import { Boton, Opcion } from "../../componentes/Boton.jsx";
import { Campo } from "../../componentes/Campo.jsx";
import { Icono } from "../../componentes/Icono.jsx";
import { encolar } from "../../local/cola.js";
import { estadoSync } from "../../local/estado.js";
import { buscarProductoLocal } from "./datos.js";

const TIPOS = [
  { valor: "ENTRADA",  icono: "entrada",  texto: "Entrada" },
  { valor: "MERMA",    icono: "merma",    texto: "Merma" },
  { valor: "TRASLADO", icono: "traslado", texto: "Traslado" }
];

const MOTIVOS_MERMA = ["Vencido", "Dañado", "Roto", "Otro"];

// Entradas de proveedor, merma y traslados.
// No llama a la API: escribe en la cola local y sigue. Con red o sin red, igual
// de rápido — que es lo que hace que la usen en vez de anotar en un papel.
export function Bodega() {
  const [producto, setProducto] = useState(null);
  const [codigo, setCodigo] = useState("");
  const [tipo, setTipo] = useState("ENTRADA");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [ultimos, setUltimos] = useState([]);
  const campoCodigo = useRef(null);

  function limpiar() {
    setProducto(null);
    setCodigo("");
    setCantidad("");
    setMotivo("");
    setError(null);
    campoCodigo.current?.focus();
  }

  async function buscar() {
    const encontrado = await buscarProductoLocal(codigo.trim());
    if (!encontrado) {
      setError("Ese código no está en el catálogo.");
      setProducto(null);
      return;
    }
    setError(null);
    setProducto(encontrado);
    // La balanza ya trae el peso adentro del código: no se vuelve a preguntar.
    if (encontrado.pesoKg) setCantidad(String(encontrado.pesoKg));
  }

  async function guardar() {
    const problema = validarCantidad(cantidad, producto.unidad);
    if (problema) return setError(problema);
    if (tipo === "MERMA" && !motivo) return setError("Elige el motivo de la merma.");

    setGuardando(true);
    try {
      await encolar("movimiento", "/inventario/movimientos", {
        productoId: producto.id,
        tipo,
        cantidad: Number(cantidad),
        motivo: motivo || null
      });
      estadoSync.getState().refrescarPendientes();
      setUltimos((u) => [
        { nombre: producto.nombre, tipo, cantidad: Number(cantidad), hora: new Date() },
        ...u
      ].slice(0, 6));
      limpiar();
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Marco titulo="Bodega">
      <section className="border-b border-borde bg-panel px-4 py-4">
        {/* El lector USB escribe aquí y cierra con Enter: no hay que tocar nada. */}
        <Campo
          etiqueta="Código del producto"
          refCampo={campoCodigo}
          valor={codigo}
          onChange={setCodigo}
          onKeyDown={undefined}
          alPresionarEnter={buscar}
          ejemplo="Escanea o escribe"
          inputMode="numeric"
          autoFoco
          error={!producto ? error : null}
        />

        {!producto && (
          <p className="mt-2 flex items-center gap-2 text-sm text-tenue">
            <Icono nombre="escanear" tam={17} />
            El lector escribe solo. Con teclado, presiona Enter.
          </p>
        )}
      </section>

      {producto && (
        <section className="border-b border-borde bg-panel px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[19px] font-semibold leading-tight">{producto.nombre}</p>
              <p className="cifras mt-0.5 text-sm text-tenue">
                {producto.codigoBarras} · por {producto.unidad}
              </p>
            </div>
            <button
              onClick={limpiar}
              aria-label="Cambiar de producto"
              className="min-h-11 min-w-11 rounded-pieza border border-borde text-tenue transition-colors duration-100 hover:bg-panel-alt"
            >
              <Icono nombre="falta" tam={18} className="mx-auto" />
            </button>
          </div>

          <fieldset className="mt-4">
            <legend className="mb-1.5 text-sm font-semibold text-tenue">Tipo de movimiento</legend>
            <div className="flex gap-2">
              {TIPOS.map((t) => (
                <Opcion
                  key={t.valor}
                  activo={tipo === t.valor}
                  onClick={() => { setTipo(t.valor); setError(null); }}
                  icono={t.icono}
                >
                  {t.texto}
                </Opcion>
              ))}
            </div>
          </fieldset>

          {tipo === "MERMA" && (
            <fieldset className="mt-4">
              <legend className="mb-1.5 text-sm font-semibold text-tenue">Motivo</legend>
              <div className="grid grid-cols-4 gap-2">
                {MOTIVOS_MERMA.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMotivo(m); setError(null); }}
                    aria-pressed={motivo === m}
                    className={
                      "min-h-12 rounded-pieza border-2 px-1 text-sm font-semibold transition-colors duration-100 " +
                      (motivo === m
                        ? "border-acento bg-acento-suave text-acento"
                        : "border-borde bg-panel text-tenue hover:border-borde-fuerte")
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-4">
            <Campo
              etiqueta="Cantidad"
              valor={cantidad}
              onChange={(v) => { setCantidad(v); setError(null); }}
              ejemplo={producto.unidad === "kg" ? "2.5" : "12"}
              inputMode="decimal"
              sufijo={producto.unidad === "kg" ? "kg" : "und"}
              error={error}
            />
          </div>

          <div className="mt-4">
            <Boton tono="principal" onClick={guardar} cargando={guardando} icono="listo">
              Guardar movimiento
            </Boton>
            <p className="mt-2 text-center text-sm text-tenue">
              Queda guardado aquí y sube solo cuando haya señal.
            </p>
          </div>
        </section>
      )}

      <section>
        <h2 className="px-4 pt-5 pb-2 text-sm font-semibold uppercase tracking-wide text-tenue">
          Registrado en este turno
        </h2>

        {ultimos.length === 0 ? (
          <Vacio
            icono="bodega"
            titulo="Todavía no has registrado nada"
            detalle="Escanea un producto arriba para registrar una entrada, una merma o un traslado."
          />
        ) : (
          ultimos.map((m, i) => (
            <Fila key={i}>
              <span className={m.tipo === "ENTRADA" ? "text-ok" : "text-peligro"}>
                <Icono nombre={m.tipo.toLowerCase()} tam={19} />
              </span>
              <span className="flex-1 truncate">{m.nombre}</span>
              <span
                className={
                  "cifras text-[17px] font-semibold " +
                  (m.tipo === "ENTRADA" ? "text-ok" : "text-peligro")
                }
              >
                {m.tipo === "ENTRADA" ? "+" : "−"}{m.cantidad}
              </span>
              <span className="cifras w-12 text-right text-sm text-tenue">
                {m.hora.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </Fila>
          ))
        )}
      </section>
    </Marco>
  );
}

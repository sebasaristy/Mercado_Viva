import { useState } from "react";
import { Marco, Vacio } from "../../componentes/Marco.jsx";
import { Boton } from "../../componentes/Boton.jsx";
import { Icono } from "../../componentes/Icono.jsx";

// Recolección. Lo importante de esta pantalla es el botón de "no lo encontré":
// cuando el recolector lo toca, un humano acaba de mirar el estante. Es el
// mejor dato de inventario que tiene la cadena, y casi nadie lo guarda.
const PEDIDO = {
  codigo: "MV-2041",
  cliente: "Laura Gómez",
  reglaSustitucion: "Acepta marca equivalente",
  lineas: [
    { id: 1, nombre: "Arroz Diana 500 g",  cantidad: 2,   unidad: "unidad", ubicacion: "Pasillo 3",    estado: "pendiente" },
    { id: 2, nombre: "Leche Alquería 1 L", cantidad: 4,   unidad: "unidad", ubicacion: "Refrigerados", estado: "pendiente" },
    { id: 3, nombre: "Banano",             cantidad: 1.2, unidad: "kg",     ubicacion: "Frutas",       estado: "pendiente" },
    { id: 4, nombre: "Huevos AA x 30",     cantidad: 1,   unidad: "unidad", ubicacion: "Pasillo 1",    estado: "pendiente" }
  ]
};

const REEMPLAZOS = { 1: "Arroz Roa 500 g", 2: "Leche Colanta 1 L" };

const ETIQUETA = {
  picada: "Recogido",
  sustituida: "Reemplazado",
  no_disponible: "No había"
};

export function Picking() {
  const [lineas, setLineas] = useState(PEDIDO.lineas);
  const [proponiendo, setProponiendo] = useState(null);

  const cambiar = (id, estado, extra = {}) =>
    setLineas((ls) => ls.map((l) => (l.id === id ? { ...l, estado, ...extra } : l)));

  function marcarFaltante(linea) {
    // El faltante corrige el inventario al instante: el disponible de ese
    // producto se pone en cero y se genera una tarea de reconteo.
    cambiar(linea.id, "no_disponible");
    if (REEMPLAZOS[linea.id]) setProponiendo(linea);
  }

  const pendientes = lineas.filter((l) => l.estado === "pendiente").length;
  const resueltas = lineas.length - pendientes;

  return (
    <Marco titulo="Recolección">
      <section className="border-b border-borde bg-panel px-4 py-4">
        <div className="flex items-baseline justify-between">
          <p className="cifras text-[17px] font-semibold">{PEDIDO.codigo}</p>
          <p className="text-sm text-tenue">{PEDIDO.cliente}</p>
        </div>
        <p className="cifras mt-1 text-sm text-tenue">
          {resueltas} de {lineas.length} líneas resueltas
        </p>
        <p className="mt-2 text-sm text-tenue">{PEDIDO.reglaSustitucion}</p>
      </section>

      {proponiendo && (
        <section className="border-b border-borde bg-acento-suave px-4 py-4">
          <p className="text-[15px] font-semibold text-acento">
            No hay {proponiendo.nombre}
          </p>
          <p className="mt-1 text-[15px]">
            La clienta aceptó marca equivalente al comprar. Se puede reemplazar por{" "}
            <strong>{REEMPLAZOS[proponiendo.id]}</strong>, al mismo precio.
          </p>
          <div className="mt-3 flex gap-2">
            <Boton tono="neutro" onClick={() => setProponiendo(null)}>
              No reemplazar
            </Boton>
            <Boton
              tono="principal"
              icono="listo"
              onClick={() => {
                cambiar(proponiendo.id, "sustituida", { sustituto: REEMPLAZOS[proponiendo.id] });
                setProponiendo(null);
              }}
            >
              Reemplazar
            </Boton>
          </div>
        </section>
      )}

      <section>
        {lineas.length === 0 ? (
          <Vacio
            icono="picking"
            titulo="No hay pedidos asignados"
            detalle="Cuando el supervisor te asigne un pedido, aparece aquí con su lista."
          />
        ) : (
          lineas.map((l) => (
            <div key={l.id} className="border-b border-borde bg-panel px-4 py-3">
              <div className="flex items-start gap-3">
                <span className="cifras mt-0.5 w-14 shrink-0 text-[19px] font-semibold">
                  {l.cantidad}
                  {l.unidad === "kg" && (
                    <span className="ml-0.5 text-sm font-normal text-tenue">kg</span>
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={
                      "text-[17px] leading-tight " +
                      (l.estado === "no_disponible" ? "text-tenue line-through" : "")
                    }
                  >
                    {l.nombre}
                  </p>
                  <p className="mt-0.5 text-sm text-tenue">{l.ubicacion}</p>

                  {l.estado === "sustituida" && (
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-acento">
                      <Icono nombre="traslado" tam={15} />
                      Reemplazado por {l.sustituto}
                    </p>
                  )}
                </div>

                {l.estado === "pendiente" ? (
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => marcarFaltante(l)}
                      aria-label={"No encontré " + l.nombre}
                      className="flex min-h-12 min-w-12 items-center justify-center rounded-pieza border-2 border-borde-fuerte text-tenue transition-colors duration-100 hover:border-peligro hover:text-peligro"
                    >
                      <Icono nombre="falta" tam={20} />
                    </button>
                    <button
                      onClick={() => cambiar(l.id, "picada")}
                      aria-label={"Recogí " + l.nombre}
                      className="flex min-h-12 min-w-12 items-center justify-center rounded-pieza border-2 border-acento bg-acento text-white transition-colors duration-100 hover:bg-acento-hover"
                    >
                      <Icono nombre="listo" tam={20} />
                    </button>
                  </div>
                ) : (
                  // El estado se marca con icono y texto, no solo con color:
                  // el color por sí solo deja por fuera a quien no lo distingue.
                  <span
                    className={
                      "flex shrink-0 items-center gap-1.5 text-sm font-semibold " +
                      (l.estado === "picada"
                        ? "text-ok"
                        : l.estado === "sustituida"
                        ? "text-acento"
                        : "text-tenue")
                    }
                  >
                    <Icono nombre={l.estado === "no_disponible" ? "falta" : "listo"} tam={17} />
                    {ETIQUETA[l.estado]}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </section>

      {pendientes === 0 && lineas.length > 0 && (
        <div className="px-4 py-5">
          <Boton tono="principal" icono="listo">
            Cerrar pedido
          </Boton>
        </div>
      )}
    </Marco>
  );
}

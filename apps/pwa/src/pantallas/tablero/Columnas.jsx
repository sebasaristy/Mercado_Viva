import { useState } from "react";
import { pesosCorto } from "../../lib/formato.js";

// Columnas de una sola serie. Todas del mismo gris de contexto, salvo la que
// importa (la hora actual, hoy), que va en el acento: el color no codifica el
// valor, codifica "esta es la que estás mirando". El alto ya dice cuánto.
//
// Marcas finas (máximo 24 px) con la punta redondeada y la base recta, rejilla
// en línea fina, etiqueta solo en las columnas que la merecen, y el valor de
// cualquier columna al pasar el mouse o enfocarla con el teclado. Nada queda
// solo detrás del tooltip: debajo está la vista de tabla.

function escalaLimpia(maximo, marcas = 4) {
  if (!(maximo > 0)) return { tope: 1, marcas: [0] };
  const conAire = maximo * 1.15;
  const bruto = conAire / marcas;
  const potencia = 10 ** Math.floor(Math.log10(bruto));
  const paso = [1, 2, 2.5, 5, 10].map((m) => m * potencia).find((p) => p >= bruto);
  const tope = paso * Math.ceil(conAire / paso);
  const lista = [];
  for (let v = 0; v <= tope + paso / 2; v += paso) lista.push(Math.round(v));
  return { tope, marcas: lista };
}

export function Columnas({ titulo, puntos, destacado, etiquetar = [], formatoValor, alto = 176 }) {
  const [activa, setActiva] = useState(null);
  const maximo = Math.max(0, ...puntos.map((p) => p.valor));
  const escala = escalaLimpia(maximo);
  const vacio = maximo <= 0;

  return (
    <figure className="m-0">
      <div className="flex gap-2">
        <div aria-hidden="true" className="relative w-16 shrink-0" style={{ height: alto, marginTop: 20 }}>
          {escala.marcas.map((v) => (
            <span
              key={v}
              className="cifras absolute right-0 translate-y-1/2 text-[11px] leading-none text-tenue"
              style={{ bottom: `${(v / escala.tope) * 100}%` }}
            >
              {pesosCorto(v)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height: alto, marginTop: 20 }}>
            {escala.marcas.map((v) => (
              <div
                key={v}
                aria-hidden="true"
                className={`absolute inset-x-0 h-px ${v === 0 ? "bg-borde-fuerte" : "bg-borde"}`}
                style={{ bottom: `${(v / escala.tope) * 100}%` }}
              />
            ))}

            {vacio && (
              <p className="absolute inset-0 flex items-center justify-center text-sm text-tenue">
                Todavía no hay ventas en este período.
              </p>
            )}

            <ul aria-label={titulo} className="absolute inset-0 m-0 flex list-none items-end p-0">
              {puntos.map((p, i) => {
                const pct = (p.valor / escala.tope) * 100;
                const esDestacado = i === destacado;
                const mostrarEtiqueta = etiquetar.includes(i) && p.valor > 0 && activa === null;
                const alineacion =
                  i < 2 ? "left-0" : i > puntos.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2";

                return (
                  <li
                    key={p.clave}
                    tabIndex={0}
                    aria-label={`${p.etiqueta}: ${formatoValor(p.valor)}`}
                    onMouseEnter={() => setActiva(i)}
                    onMouseLeave={() => setActiva(null)}
                    onFocus={() => setActiva(i)}
                    onBlur={() => setActiva(null)}
                    className="relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center rounded-pieza focus-visible:outline-offset-[-2px]"
                  >
                    {p.valor > 0 && (
                      <div
                        aria-hidden="true"
                        className={
                          "w-[min(24px,64%)] rounded-t-[4px] transition-opacity duration-100 " +
                          (esDestacado ? "bg-acento" : "bg-contexto") +
                          (activa !== null && activa !== i ? " opacity-45" : "")
                        }
                        style={{ height: `${Math.max(pct, 1)}%` }}
                      />
                    )}

                    {mostrarEtiqueta && (
                      <span
                        aria-hidden="true"
                        className="cifras pointer-events-none absolute whitespace-nowrap text-[11px] font-semibold leading-none text-tinta"
                        style={{ bottom: `calc(${pct}% + 5px)` }}
                      >
                        {pesosCorto(p.valor)}
                      </span>
                    )}

                    {activa === i && (
                      <div
                        role="tooltip"
                        className={`pointer-events-none absolute z-10 whitespace-nowrap rounded-pieza border border-borde bg-panel px-2.5 py-1.5 shadow-[0_8px_20px_-10px_rgba(22,25,15,0.4)] ${alineacion}`}
                        style={{ bottom: `calc(${Math.max(pct, 1)}% + 8px)` }}
                      >
                        <p className="cifras text-[15px] font-semibold leading-tight text-tinta">{formatoValor(p.valor)}</p>
                        <p className="text-xs leading-tight text-tenue">{p.etiqueta}</p>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>

          <div aria-hidden="true" className="flex pt-2">
            {puntos.map((p, i) => (
              <span
                key={p.clave}
                className={
                  "flex-1 whitespace-nowrap text-center text-[11px] " +
                  (i === destacado ? "font-semibold text-tinta" : "text-tenue")
                }
              >
                {p.etiquetaCorta}
              </span>
            ))}
          </div>
        </div>
      </div>

      <details className="mt-3">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-semibold text-tenue hover:text-tinta">
          Ver como tabla
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full min-w-[240px] text-sm">
            <caption className="sr-only">{titulo}</caption>
            <thead>
              <tr className="border-b border-borde text-left text-tenue">
                <th scope="col" className="py-1.5 pr-3 font-semibold">Período</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Ventas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-borde">
              {puntos.map((p) => (
                <tr key={p.clave}>
                  <td className="py-1.5 pr-3">{p.etiqueta}</td>
                  <td className="cifras py-1.5 text-right">{formatoValor(p.valor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

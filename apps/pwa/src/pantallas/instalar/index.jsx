import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import { Aviso, Boton, Segmentado } from "../../componentes/ui.jsx";
import { Icono } from "../../componentes/Icono.jsx";
import { avisar, ZonaAvisos } from "../../componentes/Avisos.jsx";
import { usarSesion } from "../../api/sesion.js";
import {
  usarInstalacion, pedirInstalacion, detectarEquipo, esSafari
} from "../../lib/instalacion.js";

// La página que se comparte (o se imprime con su QR y se pega en la bodega)
// para que cada empleado instale la app. No pide sesión.
const EQUIPOS = [
  { valor: "iphone", texto: "iPhone", icono: "celular" },
  { valor: "android", texto: "Android", icono: "celular" },
  { valor: "computador", texto: "Computador", icono: "computador" }
];

export function Instalar() {
  const detectado = detectarEquipo();
  const [equipo, setEquipo] = useState(detectado);
  const { evento, instalada } = usarInstalacion();
  const hayUsuario = usarSesion((s) => Boolean(s.usuario));
  const direccion = window.location.origin;
  const segura = window.isSecureContext;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(direccion);
      avisar({ titulo: "Enlace copiado", texto: direccion });
    } catch {
      avisar({ tono: "atencion", titulo: "No se pudo copiar", texto: direccion });
    }
  };

  return (
    <div className="min-h-dvh bg-fondo">
      <header className="border-b border-borde bg-panel print:border-0">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 lg:px-8">
          <span className="flex items-center gap-2.5">
            <img src="/favicon.svg" alt="" width="28" height="28" />
            <span className="font-semibold tracking-tight">Mercado Viva</span>
          </span>
          <Link to="/" className="inline-flex min-h-11 items-center gap-1.5 text-[15px] font-semibold text-tinta print:hidden">
            {hayUsuario ? "Volver a la app" : "Entrar"}
            <Icono nombre="flecha" tam={16} />
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-6 lg:grid-cols-[minmax(0,1fr)_300px] lg:px-8 lg:py-10">
        <div className="flex min-w-0 flex-col gap-5">
          <div>
            <h1 className="text-[28px] font-semibold leading-tight tracking-tight">Instala la app en tu celular</h1>
            <p className="mt-2 max-w-[60ch] text-[17px] text-tenue">
              Queda con su ícono junto a tus otras apps, abre a pantalla completa y sigue funcionando
              cuando se va la señal en la bodega.
            </p>
          </div>

          {instalada && (
            <Aviso tono="exito" titulo="Ya estás en la app instalada"
              accion={<Link to="/" className="inline-flex min-h-11 items-center font-semibold text-ok underline underline-offset-4">Abrir</Link>} />
          )}

          {!segura && (
            <Aviso tono="atencion" titulo="Esta dirección no tiene candado (https)">
              Los celulares solo instalan apps desde direcciones seguras. Abre la dirección con https que
              te dio el administrador.
            </Aviso>
          )}

          <div className="print:hidden">
            <Segmentado etiqueta="¿Dónde la vas a instalar?" apilado opciones={EQUIPOS} valor={equipo} onCambio={setEquipo} />
          </div>

          {equipo === "iphone" && (
            <>
              {detectado === "iphone" && !esSafari() && (
                <Aviso tono="atencion" titulo="Ábrela en Safari"
                  accion={<Boton tam="chico" icono="copiar" onClick={copiar}>Copiar enlace</Boton>}>
                  En iPhone la opción de instalar está en Safari. Copia el enlace, abre Safari y pégalo.
                </Aviso>
              )}
              <Pasos>
                <Paso n={1} titulo="Abre esta página en Safari">La brújula azul. Chrome en iPhone no siempre muestra la opción.</Paso>
                <Paso n={2} icono="compartir" titulo="Toca Compartir">
                  El cuadrado con la flecha hacia arriba: abajo en el centro en iPhone, arriba a la derecha en iPad.
                </Paso>
                <Paso n={3} icono="agregarInicio" titulo="Toca «Agregar a inicio»">Si no la ves, desliza la lista hacia abajo.</Paso>
                <Paso n={4} titulo="Toca «Agregar»">
                  Arriba a la derecha. El ícono de Mercado Viva aparece en tu pantalla de inicio: ábrela desde ahí.
                </Paso>
              </Pasos>
            </>
          )}

          {equipo === "android" && (
            <>
              {evento && (
                <Boton tono="principal" tam="grande" icono="agregarInicio" onClick={pedirInstalacion} className="self-start">
                  Instalar la app
                </Boton>
              )}
              <Pasos>
                <Paso n={1} titulo="Abre esta página en Chrome">
                  {evento ? "O instálala a mano, si el botón no aparece:" : "Samsung Internet también sirve."}
                </Paso>
                <Paso n={2} icono="menuPuntos" titulo="Toca el menú ⋮">Arriba a la derecha.</Paso>
                <Paso n={3} icono="agregarInicio" titulo="Toca «Instalar app»">
                  En algunos celulares dice «Agregar a la pantalla principal».
                </Paso>
                <Paso n={4} titulo="Confirma con «Instalar»">Queda en tu lista de apps, como cualquier otra.</Paso>
              </Pasos>
            </>
          )}

          {equipo === "computador" && (
            <>
              {evento && (
                <Boton tono="principal" tam="grande" icono="agregarInicio" onClick={pedirInstalacion} className="self-start">
                  Instalar en este computador
                </Boton>
              )}
              <Pasos>
                <Paso n={1} icono="celular" titulo="Para el celular, escanea el código">
                  Con la cámara del celular apunta al código de esta página y sigue los pasos de iPhone o Android.
                </Paso>
                <Paso n={2} icono="computador" titulo="Para la caja o la oficina">
                  En Chrome o Edge, toca el ícono de instalar al final de la barra de direcciones.
                </Paso>
              </Pasos>
            </>
          )}
        </div>

        <aside className="flex flex-col gap-3 lg:pt-2">
          <div className="rounded-pieza border border-borde bg-panel p-4">
            <p className="font-semibold">Desde otro celular</p>
            <p className="mt-0.5 text-sm text-tenue">Escanéalo con la cámara.</p>
            <CodigoQr texto={direccion + "/instalar"} />
            <p className="cifras mt-2 break-all text-center text-sm text-tenue">{direccion.replace(/^https?:\/\//, "")}</p>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Boton tam="chico" icono="copiar" onClick={copiar}>Copiar enlace</Boton>
            <Boton tam="chico" icono="imprimir" onClick={() => window.print()}>Imprimir</Boton>
          </div>
        </aside>
      </main>
      <ZonaAvisos />
    </div>
  );
}

function CodigoQr({ texto }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    QRCode.toString(texto, {
      type: "svg", margin: 1, errorCorrectionLevel: "M",
      color: { dark: "#16190F", light: "#FFFFFF" }
    }).then(setSvg).catch(() => setSvg(""));
  }, [texto]);

  return (
    <div
      role="img"
      aria-label={`Código QR de ${texto}`}
      className="mx-auto mt-3 aspect-square w-full max-w-56 [&>svg]:h-full [&>svg]:w-full"
      // SVG generado por la librería a partir de la dirección de esta misma página.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}

function Pasos({ children }) {
  return <ol className="m-0 flex list-none flex-col gap-0 p-0">{children}</ol>;
}

function Paso({ n, icono, titulo, children }) {
  return (
    <li className="relative flex gap-4 pb-5 last:pb-0 [&:not(:last-child)]:before:absolute [&:not(:last-child)]:before:left-[17px] [&:not(:last-child)]:before:top-10 [&:not(:last-child)]:before:bottom-1 [&:not(:last-child)]:before:w-px [&:not(:last-child)]:before:bg-borde">
      <span className="cifras flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-tinta bg-panel text-[15px] font-semibold">
        {n}
      </span>
      <div className="min-w-0 pt-1">
        <p className="flex items-center gap-2 font-semibold">
          {titulo}
          {icono && <Icono nombre={icono} tam={19} className="text-acento" />}
        </p>
        {children && <p className="mt-0.5 text-[15px] text-tenue">{children}</p>}
      </div>
    </li>
  );
}

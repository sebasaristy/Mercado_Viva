import { useEffect, useRef, useState } from "react";
import { Icono } from "./Icono.jsx";
import { Boton } from "./ui.jsx";

// Tres formas de meter un código, de la más rápida a la más lenta:
//  1. Lector USB o Bluetooth: escribe en el campo y manda Enter solo.
//  2. La cámara del celular o la tablet.
//  3. Escribirlo a mano y tocar Buscar.
//
// Es un <form>: Enter del lector, "Ir" del teclado del celular y el botón Buscar
// terminan en el mismo lugar. Antes solo servía Enter, y en el teclado de
// pantalla no había forma de avanzar.
export function LectorCodigo({ onCodigo, ocupado = false, etiqueta = "Código de barras", autoFoco = true }) {
  const [codigo, setCodigo] = useState("");
  const [conCamara, setConCamara] = useState(false);
  const campo = useRef(null);

  useEffect(() => {
    if (autoFoco) campo.current?.focus();
  }, [autoFoco]);

  function enviar(valor) {
    const limpio = String(valor ?? codigo).trim();
    if (!limpio || ocupado) return;
    onCodigo(limpio);
    setCodigo("");
    requestAnimationFrame(() => campo.current?.focus());
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="lector-codigo" className="text-sm font-semibold text-tinta">{etiqueta}</label>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tenue">
            <Icono nombre="escanear" tam={20} />
          </span>
          <input
            id="lector-codigo"
            ref={campo}
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            inputMode="numeric"
            enterKeyHint="search"
            autoComplete="off"
            placeholder="Escanea o escribe"
            className="cifras min-h-14 w-full rounded-pieza border-2 border-borde-fuerte bg-panel pl-11 pr-3 text-[18px] text-tinta placeholder:font-sans placeholder:text-tenue/60 focus:border-acento"
          />
        </div>
        <Boton type="submit" tono="principal" tam="grande" cargando={ocupado} disabled={!codigo.trim()}>
          Buscar
        </Boton>
        <Boton
          tono="secundario"
          tam="grande"
          icono="camara"
          onClick={() => setConCamara(true)}
          aria-label="Escanear con la cámara"
          className="px-3.5"
        />
      </form>

      {conCamara && (
        <CamaraEscaner
          onCodigo={(c) => {
            setConCamara(false);
            enviar(c);
          }}
          onCerrar={() => {
            setConCamara(false);
            campo.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function CamaraEscaner({ onCodigo, onCerrar }) {
  const video = useRef(null);
  const alLeer = useRef(onCodigo);
  alLeer.current = onCodigo;
  const [error, setError] = useState(null);

  useEffect(() => {
    let controles = null;
    let activo = true;

    const cerrarConEsc = (e) => e.key === "Escape" && onCerrar();
    addEventListener("keydown", cerrarConEsc);

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("La cámara solo funciona en https o en localhost. Escribe el código o usa un lector.");
        return;
      }
      try {
        // Se carga solo si se usa la cámara: la mayoría de las veces se escanea con lector.
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const lector = new BrowserMultiFormatReader();
        controles = await lector.decodeFromConstraints(
          { video: { facingMode: { ideal: "environment" } } },
          video.current,
          (resultado) => {
            if (resultado && activo) {
              activo = false;
              controles?.stop();
              navigator.vibrate?.(60);
              alLeer.current(resultado.getText());
            }
          }
        );
        if (!activo) controles.stop();
      } catch (e) {
        setError(
          e?.name === "NotAllowedError"
            ? "No hay permiso para usar la cámara. Actívalo en el candado de la barra de direcciones, o escribe el código."
            : e?.name === "NotFoundError" || e?.name === "OverconstrainedError"
            ? "Este equipo no tiene una cámara disponible. Escribe el código o usa un lector."
            : "No se pudo abrir la cámara. Escribe el código o usa un lector."
        );
      }
    })();

    return () => {
      activo = false;
      controles?.stop();
      removeEventListener("keydown", cerrarConEsc);
    };
  }, [onCerrar]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Escanear con la cámara"
      className="fixed inset-0 z-50 flex items-center justify-center bg-tinta/80 p-4"
    >
      <div className="w-full max-w-md overflow-hidden rounded-pieza bg-panel shadow-[0_20px_50px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between border-b border-borde px-4 py-3">
          <p className="font-semibold">Apunta al código de barras</p>
          <Boton tono="fantasma" tam="chico" icono="cerrar" onClick={onCerrar} aria-label="Cerrar cámara" />
        </div>
        {error ? (
          <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <Icono nombre="camara" tam={36} className="text-borde-fuerte" />
            <p className="text-[15px]">{error}</p>
            <Boton onClick={onCerrar}>Escribir el código</Boton>
          </div>
        ) : (
          <div className="relative aspect-[4/3] bg-tinta">
            <video ref={video} className="h-full w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-x-8 top-1/2 h-24 -translate-y-1/2 rounded-pieza border-2 border-white/90" />
          </div>
        )}
      </div>
    </div>
  );
}

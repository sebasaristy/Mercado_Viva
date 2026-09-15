import { Icono } from "./Icono.jsx";

// Las piezas con las que se arman todas las pantallas. Si una pantalla necesita
// un botón o un campo que no está aquí, se agrega aquí: no se inventa otro.

const TONOS_BOTON = {
  principal:
    "bg-acento text-white border-acento hover:bg-acento-hover active:bg-acento-hover " +
    // Apagado pero legible: gris claro con texto tenue (5,5:1), no blanco sobre gris.
    "disabled:bg-panel-alt disabled:border-borde disabled:text-tenue",
  secundario:
    "bg-panel text-tinta border-borde-fuerte hover:bg-panel-alt active:bg-panel-alt disabled:text-tenue",
  peligro: "bg-panel text-peligro border-peligro/50 hover:bg-peligro-suave active:bg-peligro-suave",
  fantasma: "bg-transparent text-tinta border-transparent hover:bg-panel-alt active:bg-panel-alt"
};

const TAMANOS_BOTON = {
  // 44 px incluso en el chico: se toca con guantes y en movimiento.
  chico: "min-h-11 px-3 text-sm",
  normal: "min-h-12 px-4 text-[15px]",
  grande: "min-h-14 px-5 text-[17px]"
};

export function Boton({
  children, tono = "secundario", tam = "normal", icono, cargando, disabled, className = "", ...resto
}) {
  return (
    <button
      type="button"
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={
        "inline-flex items-center justify-center gap-2 rounded-pieza border-2 font-semibold " +
        "transition-colors duration-100 disabled:cursor-not-allowed " +
        `${TAMANOS_BOTON[tam]} ${TONOS_BOTON[tono]} ${className}`
      }
      {...resto}
    >
      {cargando ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        icono && <Icono nombre={icono} tam={tam === "chico" ? 16 : 20} />
      )}
      {children}
    </button>
  );
}

// La etiqueta siempre visible: el placeholder es un ejemplo, no la etiqueta,
// porque desaparece justo cuando se está escribiendo.
export function Campo({ id, etiqueta, ayuda, error, prefijo, sufijo, className = "", ...input }) {
  const descripcion = error ? `${id}-error` : ayuda ? `${id}-ayuda` : undefined;
  return (
    <div className={"flex flex-col gap-1.5 " + className}>
      <label htmlFor={id} className="text-sm font-semibold text-tinta">{etiqueta}</label>
      <div className="relative">
        {prefijo && (
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-tenue">
            {prefijo}
          </span>
        )}
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={descripcion}
          className={
            "min-h-12 w-full rounded-pieza border-2 bg-panel text-[17px] text-tinta " +
            "placeholder:text-tenue/60 transition-colors duration-100 focus:border-acento " +
            `${prefijo ? "pl-8" : "pl-3.5"} ${sufijo ? "pr-14" : "pr-3.5"} ` +
            (error ? "border-peligro" : "border-borde-fuerte")
          }
          {...input}
        />
        {sufijo && (
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-tenue">
            {sufijo}
          </span>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="flex items-center gap-1.5 text-sm font-medium text-peligro">
          <Icono nombre="alerta" tam={15} />
          {error}
        </p>
      ) : ayuda ? (
        <p id={`${id}-ayuda`} className="text-sm text-tenue">{ayuda}</p>
      ) : null}
    </div>
  );
}

// Pocas opciones excluyentes, siempre visibles. Un <select> escondería las
// opciones detrás de un toque más, y en la tablet con guantes se falla.
// apilado: icono arriba y texto abajo, para cuando las palabras son largas
// ("Transferencia") y en fila se cortarían.
export function Segmentado({ etiqueta, opciones, valor, onCambio, apilado = false }) {
  return (
    <fieldset>
      {etiqueta && <legend className="mb-1.5 text-sm font-semibold text-tinta">{etiqueta}</legend>}
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${opciones.length}, minmax(0, 1fr))` }}
      >
        {opciones.map((o) => {
          const activo = valor === o.valor;
          return (
            <button
              key={o.valor}
              type="button"
              aria-pressed={activo}
              onClick={() => onCambio(o.valor)}
              className={
                (apilado
                  ? "flex min-h-16 flex-col items-center justify-center gap-1 rounded-pieza border-2 px-1 py-2 text-sm "
                  : "flex min-h-12 items-center justify-center gap-1.5 rounded-pieza border-2 px-2 text-[15px] ") +
                "font-semibold transition-colors duration-100 " +
                (activo
                  ? "border-acento bg-acento-suave text-acento"
                  : "border-borde bg-panel text-tenue hover:border-borde-fuerte hover:text-tinta")
              }
            >
              {o.icono && <Icono nombre={o.icono} tam={18} />}
              <span className="truncate">{o.texto}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

// Muchas opciones cortas que se acomodan en varias filas.
export function Chips({ etiqueta, opciones, valor, onCambio, error }) {
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-tinta">{etiqueta}</legend>
      <div className="flex flex-wrap gap-2">
        {opciones.map((o) => {
          const activo = valor === o;
          return (
            <button
              key={o}
              type="button"
              aria-pressed={activo}
              onClick={() => onCambio(o)}
              className={
                "min-h-11 rounded-pieza border-2 px-3 text-[15px] font-medium transition-colors duration-100 " +
                (activo
                  ? "border-acento bg-acento-suave text-acento"
                  : "border-borde bg-panel text-tinta hover:border-borde-fuerte")
              }
            >
              {o}
            </button>
          );
        })}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 flex items-center gap-1.5 text-sm font-medium text-peligro">
          <Icono nombre="alerta" tam={15} />
          {error}
        </p>
      )}
    </fieldset>
  );
}

// Cantidad con botones de menos y más. Por kilo acepta decimales y salta de a medio.
export function Cantidad({ id, etiqueta, valor, onCambio, unidad, compacto = false }) {
  const paso = unidad === "kg" ? 0.5 : 1;
  const n = Number(valor) || 0;
  const cambiar = (delta) => {
    const nuevo = Math.max(0, Math.round((n + delta) * 1000) / 1000);
    onCambio(nuevo === 0 ? "" : String(nuevo));
  };
  const alto = compacto ? "min-h-11" : "min-h-12";
  const botonClase =
    `flex ${alto} ${compacto ? "w-11" : "w-12"} shrink-0 items-center justify-center rounded-pieza border-2 ` +
    "border-borde-fuerte bg-panel text-tinta transition-colors duration-100 hover:bg-panel-alt " +
    "disabled:cursor-not-allowed disabled:text-borde-fuerte";

  return (
    <div className="flex flex-col gap-1.5">
      {etiqueta && <label htmlFor={id} className="text-sm font-semibold text-tinta">{etiqueta}</label>}
      <div className="flex items-stretch gap-1.5">
        <button type="button" onClick={() => cambiar(-paso)} disabled={n <= 0}
          aria-label={`Quitar ${unidad === "kg" ? "medio kilo" : "una unidad"}`} className={botonClase}>
          <Icono nombre="menos" tam={18} />
        </button>
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            value={valor}
            onChange={(e) => onCambio(e.target.value.replace(",", ".").replace(/[^\d.]/g, ""))}
            inputMode={unidad === "kg" ? "decimal" : "numeric"}
            autoComplete="off"
            aria-label={etiqueta ? undefined : unidad === "kg" ? "Cantidad en kilos" : "Cantidad en unidades"}
            placeholder="0"
            className={
              `cifras ${alto} w-full rounded-pieza border-2 border-borde-fuerte bg-panel ` +
              // En la versión compacta la unidad no va adentro: en 56 px se comía el
              // número y "0.85" se veía "0". La unidad ya está al lado, en el precio.
              `${compacto ? "px-1 text-[17px]" : "pr-9 pl-2 text-[20px]"} ` +
              "text-center font-semibold text-tinta placeholder:text-tenue/50 focus:border-acento"
            }
          />
          {!compacto && (
            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-tenue">
              {unidad === "kg" ? "kg" : "und"}
            </span>
          )}
        </div>
        <button type="button" onClick={() => cambiar(paso)}
          aria-label={`Sumar ${unidad === "kg" ? "medio kilo" : "una unidad"}`} className={botonClase}>
          <Icono nombre="mas" tam={18} />
        </button>
      </div>
    </div>
  );
}

const ESTADOS_STOCK = {
  agotado: { texto: "Agotado", clase: "bg-peligro-suave text-peligro", icono: "alerta" },
  bajo: { texto: "Stock bajo", clase: "bg-acento-suave text-acento", icono: "alerta" },
  por_agotarse: { texto: "Se agota pronto", clase: "bg-acento-suave text-acento", icono: "reloj" },
  ok: { texto: "Con stock", clase: "bg-ok-suave text-ok", icono: "listo" }
};

// Estado con icono y texto, nunca solo color.
export function EstadoStock({ estado }) {
  const e = ESTADOS_STOCK[estado] ?? ESTADOS_STOCK.ok;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${e.clase}`}>
      <Icono nombre={e.icono} tam={13} />
      {e.texto}
    </span>
  );
}

const TONOS_AVISO = {
  exito: { caja: "border-ok/40 bg-ok-suave", icono: "listo", color: "text-ok" },
  error: { caja: "border-peligro/40 bg-peligro-suave", icono: "alerta", color: "text-peligro" },
  atencion: { caja: "border-acento/40 bg-acento-suave", icono: "alerta", color: "text-acento" },
  info: { caja: "border-borde bg-panel-alt", icono: "info", color: "text-tenue" }
};

export function Aviso({ tono = "info", titulo, children, accion }) {
  const t = TONOS_AVISO[tono];
  return (
    <div role={tono === "error" ? "alert" : "status"} className={`flex gap-3 rounded-pieza border px-3.5 py-3 ${t.caja}`}>
      <Icono nombre={t.icono} tam={20} className={"mt-0.5 " + t.color} />
      <div className="min-w-0 flex-1 text-[15px] leading-snug">
        {titulo && <p className={`font-semibold ${t.color}`}>{titulo}</p>}
        {children && <div className="mt-0.5 text-tinta">{children}</div>}
        {accion && <div className="mt-2.5">{accion}</div>}
      </div>
    </div>
  );
}

// Un bloque con borde. Es el único contenedor "tarjeta" de la app.
export function Seccion({ titulo, descripcion, accion, children, className = "", sinPadding = false }) {
  return (
    // min-w-0: en celular, un hijo de grilla toma como ancho mínimo el de su
    // contenido, y una tabla de 420 px estiraba la pantalla entera. Con esto la
    // sección respeta el ancho y la tabla usa su propio scroll horizontal.
    <section className={"min-w-0 rounded-pieza border border-borde bg-panel " + className}>
      {(titulo || accion) && (
        <div className="flex items-start justify-between gap-3 border-b border-borde px-4 py-3">
          <div className="min-w-0">
            {titulo && <h2 className="text-[17px] font-semibold leading-tight">{titulo}</h2>}
            {descripcion && <p className="mt-0.5 text-sm text-tenue">{descripcion}</p>}
          </div>
          {accion}
        </div>
      )}
      <div className={sinPadding ? "" : "p-4"}>{children}</div>
    </section>
  );
}

export function Esqueleto({ className = "" }) {
  return <div aria-hidden="true" className={"animate-pulse rounded-pieza bg-panel-alt " + className} />;
}

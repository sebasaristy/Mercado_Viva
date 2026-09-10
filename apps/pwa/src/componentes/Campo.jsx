// La etiqueta siempre visible. El placeholder es un ejemplo, nunca la etiqueta:
// desaparece justo cuando el operario lo necesita, al enfocar.
export function Campo({
  etiqueta, valor, onChange, ejemplo, tipo = "text",
  inputMode, sufijo, error, autoFoco, refCampo, alPresionarEnter
}) {
  const id = "campo-" + etiqueta.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-semibold text-tenue">
        {etiqueta}
      </label>

      <div className="relative">
        <input
          id={id}
          ref={refCampo}
          type={tipo}
          inputMode={inputMode}
          value={valor}
          autoFocus={autoFoco}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && alPresionarEnter?.(e)}
          placeholder={ejemplo}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? id + "-error" : undefined}
          className={
            "cifras min-h-14 w-full rounded-pieza border-2 bg-panel px-4 " +
            "text-[19px] text-tinta placeholder:font-sans placeholder:text-borde-fuerte " +
            "transition-colors duration-100 " +
            (sufijo ? "pr-14 " : "") +
            (error ? "border-peligro" : "border-borde-fuerte focus:border-acento")
          }
        />
        {sufijo && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-tenue">
            {sufijo}
          </span>
        )}
      </div>

      {/* El error va junto al campo y con icono, no solo en rojo: el color por
          sí solo deja por fuera a quien no lo distingue. */}
      {error && (
        <p id={id + "-error"} role="alert" className="flex items-start gap-1.5 text-sm text-peligro">
          <span aria-hidden="true" className="font-bold">!</span>
          {error}
        </p>
      )}
    </div>
  );
}

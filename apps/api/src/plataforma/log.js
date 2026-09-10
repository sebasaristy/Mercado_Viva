// Envoltura mínima para no regar console.log por el código.
// Cuando entre pino o Sentry, solo cambia este archivo.
const emitir = (nivel, datos, mensaje) => {
  const linea = JSON.stringify({ nivel, ts: new Date().toISOString(), mensaje, ...datos });
  if (nivel === "error") process.stderr.write(linea + "\n");
  else process.stdout.write(linea + "\n");
};

export const log = {
  info: (datos, mensaje) => emitir("info", datos, mensaje),
  warn: (datos, mensaje) => emitir("warn", datos, mensaje),
  error: (datos, mensaje) => emitir("error", datos, mensaje)
};

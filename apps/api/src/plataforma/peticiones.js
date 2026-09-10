// Guarda las últimas peticiones en memoria para poder verlas en el panel /dev.
// No es un sistema de logs: es para mirar qué está pasando mientras se desarrolla.
const MAXIMO = 200;
const historial = [];

export const ultimasPeticiones = (n = 50) => historial.slice(0, n);

export function registrarPeticiones(req, res, siguiente) {
  const inicio = process.hrtime.bigint();

  res.on("finish", () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    historial.unshift({
      metodo: req.method,
      ruta: req.originalUrl,
      estado: res.statusCode,
      ms: Math.round(ms * 10) / 10,
      usuario: req.usuario?.id ?? null,
      idempotencia: req.get("Idempotency-Key") ?? null,
      cuando: new Date().toISOString()
    });
    if (historial.length > MAXIMO) historial.length = MAXIMO;
  });

  siguiente();
}

// Lo que se ve en la terminal mientras corre npm run dev.
export function imprimirEnTerminal(req, res, siguiente) {
  const inicio = Date.now();
  res.on("finish", () => {
    const ms = Date.now() - inicio;
    const color = res.statusCode >= 500 ? 31 : res.statusCode >= 400 ? 33 : 32;
    process.stdout.write(
      `\x1b[${color}m${res.statusCode}\x1b[0m ${req.method.padEnd(4)} ` +
      `${req.originalUrl.padEnd(42)} \x1b[2m${ms}ms\x1b[0m\n`
    );
  });
  siguiente();
}

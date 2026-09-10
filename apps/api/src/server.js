import { crearApp } from "./app.js";
import { config } from "./plataforma/config.js";
import { cerrarPool } from "./plataforma/db.js";

const servidor = crearApp().listen(config.puerto, () => {
  const url = `http://localhost:${config.puerto}`;
  process.stdout.write(
    `\n  \x1b[1mAPI arriba\x1b[0m  ${url}\n` +
    `  \x1b[2msalud\x1b[0m       ${url}/salud\n` +
    (config.esDesarrollo ? `  \x1b[2mpanel dev\x1b[0m   ${url}/dev\n` : "") +
    (config.authDesactivada ? `  \x1b[33m! auth desactivada (solo desarrollo)\x1b[0m\n` : "") +
    "\n"
  );
});

// Sin esto, --watch y Ctrl+C dejan conexiones colgadas contra Supabase.
for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => {
    servidor.close(() => cerrarPool().then(() => process.exit(0)));
  });
}

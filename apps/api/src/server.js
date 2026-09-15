import { crearApp } from "./app.js";
import { config } from "./plataforma/config.js";
import identidad from "./modulos/identidad/index.js";

const servidor = crearApp().listen(config.puerto, () => {
  const url = `http://localhost:${config.puerto}`;
  process.stdout.write(
    `\n  \x1b[1mAPI arriba\x1b[0m  ${url}\n` +
    `  \x1b[2msalud\x1b[0m       ${url}/salud\n` +
    (config.herramientasDev ? `  \x1b[2mpanel dev\x1b[0m   ${url}/dev\n` : "") +
    (config.authDesactivada ? `  \x1b[33m! auth desactivada (solo desarrollo)\x1b[0m\n` : "") +
    (config.sesion.secretoTemporal
      ? `  \x1b[33m! sin SESION_SECRETO: se usa uno temporal (bien para desarrollo)\x1b[0m\n`
      : "") +
    "\n"
  );

  // Con la tienda recién instalada nadie puede entrar: se necesita el primer
  // administrador, y crearlo pide este código. Solo lo ve quien ve esta consola.
  identidad.prepararInstalacion()
    .then((codigo) => {
      if (!codigo) return;
      process.stdout.write(
        `  \x1b[1;33mTodavía no hay usuarios.\x1b[0m\n` +
        `  Abre la app y crea el administrador con este código de instalación:\n\n` +
        `      \x1b[1m${codigo}\x1b[0m\n\n` +
        `  El código cambia cada vez que la API arranca, hasta que exista el administrador.\n\n`
      );
    })
    .catch((e) => console.error("No se pudo revisar si hay usuarios:", e.message));
});

// Sin esto, --watch y Ctrl+C dejan conexiones colgadas contra Supabase.
for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => {
    servidor.close(() => process.exit(0));
  });
}

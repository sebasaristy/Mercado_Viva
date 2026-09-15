// Sube la rama actual al servidor y la deja corriendo.
//   npm run desplegar
//
// No pasa por GitHub: empuja por SSH directo al repo del servidor, compila la
// PWA allá y reinicia la API. Tarda un minuto. Lo que no esté en un commit
// no se sube, a propósito: así siempre se sabe qué versión está en producción.
//
// Se configura con variables de entorno (o en el .env):
//   DESPLIEGUE_SSH    ec2-user@3.14.83.93
//   DESPLIEGUE_LLAVE  ruta a la llave SSH (por defecto ~/.ssh/aws_mercado)
import { execSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

for (const linea of existsSync(".env") ? readFileSync(".env", "utf8").split(/\r?\n/) : []) {
  const m = linea.match(/^\s*(DESPLIEGUE_[A-Z_]+)\s*=\s*(.*)$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].trim();
}

const destino = process.env.DESPLIEGUE_SSH ?? "ec2-user@3.14.83.93";
const llave = process.env.DESPLIEGUE_LLAVE ?? path.join(os.homedir(), ".ssh", "aws_mercado");
const ssh = `ssh -i "${llave}" -o BatchMode=yes`;

const sh = (comando) => execSync(comando, { encoding: "utf8" }).trim();

const rama = sh("git rev-parse --abbrev-ref HEAD");
const cambios = sh("git status --porcelain");
if (cambios) {
  console.log("Hay cambios sin commit; se despliega el último commit, sin ellos:\n" + cambios + "\n");
}
console.log(`Desplegando ${rama} (${sh("git log --oneline -1")}) en ${destino}\n`);

const empujar = spawnSync("git", ["push", "--force", `ssh://${destino}/home/ec2-user/mercado-viva`, `${rama}:despliegue`], {
  stdio: "inherit",
  env: { ...process.env, GIT_SSH_COMMAND: ssh }
});
if (empujar.status !== 0) process.exit(empujar.status ?? 1);

// En el servidor: la rama "despliegue" pasa a ser lo que corre.
const remoto = [
  "set -e",
  "cd ~/mercado-viva",
  // --detach: si el servidor quedara parado en la rama, el próximo push a esa
  // misma rama lo rechazaría git.
  "git checkout -q -f --detach despliegue",
  "npm ci --no-audit --no-fund --loglevel=error",
  "npm run build --workspace=apps/pwa --silent",
  "sudo cp -rT apps/pwa/dist /usr/share/nginx/mercado",
  "pm2 restart mercado-api --update-env >/dev/null",
  "sleep 8",
  "curl -s http://127.0.0.1:3000/salud"
].join(" && ");

const correr = spawnSync("ssh", ["-i", llave, "-o", "BatchMode=yes", destino, remoto], { stdio: "inherit" });
if (correr.status !== 0) process.exit(correr.status ?? 1);

console.log("\nListo. En el celular, cierra y vuelve a abrir la app para ver la versión nueva.");

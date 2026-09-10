// Corre las pruebas pasándole a node la lista explícita de archivos.
//
// Se hace así y no con "node --test 'apps/**/*.test.js'" porque ese patrón
// solo lo entiende Node 22 en adelante, y "node --test <carpeta>" carga
// archivos que no son pruebas. Enumerar aquí funciona igual en Node 20, 22 y
// 24, en Windows y en Linux, que es lo que corre el CI.
import { readdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IGNORAR = new Set(["node_modules", "dist", "dev-dist", ".git"]);

async function buscarPruebas(dir) {
  const encontrados = [];
  for (const entrada of await readdir(dir, { withFileTypes: true })) {
    if (IGNORAR.has(entrada.name)) continue;
    const completo = path.join(dir, entrada.name);
    if (entrada.isDirectory()) {
      encontrados.push(...await buscarPruebas(completo));
    } else if (entrada.name.endsWith(".test.js")) {
      encontrados.push(completo);
    }
  }
  return encontrados;
}

const archivos = (await Promise.all(
  ["apps", "packages"].map((c) => buscarPruebas(path.join(raiz, c)))
)).flat();

if (archivos.length === 0) {
  process.stderr.write("No se encontró ningún archivo *.test.js\n");
  process.exit(1);
}

process.stdout.write(`Corriendo ${archivos.length} archivos de prueba\n\n`);

spawn(process.execPath, ["--test", ...archivos], { stdio: "inherit" })
  .on("exit", (codigo) => process.exit(codigo ?? 1));

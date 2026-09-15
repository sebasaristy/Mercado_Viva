// Genera los íconos PNG de la app a partir del mismo dibujo del favicon.svg.
//   node scripts/iconos.js   ->   apps/pwa/public/*.png
//
// Android pide PNG de 192 y 512 (y uno "maskable" con margen, porque cada
// fabricante lo recorta con otra forma). iPhone ignora el SVG y el manifest:
// usa apple-touch-icon.png, sin transparencias, y le redondea las esquinas él.
//
// Sin dependencias: dibuja los trazos con muestreo 4x4 y escribe el PNG a mano.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const destino = path.join(raiz, "apps", "pwa", "public");

const FONDO = [0x16, 0x19, 0x0f];
const TRAZO = [0xe9, 0xa9, 0x3e];

// Los trazos del favicon.svg, en su cuadrícula de 32 × 32.
const SEGMENTOS = [
  [6, 11.5, 16, 6.5], [16, 6.5, 26, 11.5], [26, 11.5, 26, 20.5],
  [26, 20.5, 16, 25.5], [16, 25.5, 6, 20.5], [6, 20.5, 6, 11.5],
  [6, 11.5, 16, 16.5], [16, 16.5, 26, 11.5], [16, 16.5, 16, 25.5]
];
const GROSOR = 2;
const MUESTRAS = 4;

function distancia(px, py, [x1, y1, x2, y2]) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function dentroDelFondo(x, y, tam, radio) {
  if (radio === 0) return true;
  const cx = Math.min(Math.max(x, radio), tam - radio);
  const cy = Math.min(Math.max(y, radio), tam - radio);
  return Math.hypot(x - cx, y - cy) <= radio;
}

// margen: parte del ícono que queda libre a cada lado del dibujo.
// redondeo: radio de las esquinas como fracción del tamaño (0 = cuadrado lleno).
function dibujar(tam, { margen, redondeo }) {
  const rgba = new Uint8Array(tam * tam * 4);
  const escala = (tam * (1 - 2 * margen)) / 32;
  const corrimiento = tam * margen;
  const radio = redondeo * tam;
  const total = MUESTRAS * MUESTRAS;

  for (let y = 0; y < tam; y++) {
    for (let x = 0; x < tam; x++) {
      let fondo = 0;
      let trazo = 0;
      for (let sy = 0; sy < MUESTRAS; sy++) {
        for (let sx = 0; sx < MUESTRAS; sx++) {
          const X = x + (sx + 0.5) / MUESTRAS;
          const Y = y + (sy + 0.5) / MUESTRAS;
          if (!dentroDelFondo(X, Y, tam, radio)) continue;
          fondo++;
          const gx = (X - corrimiento) / escala;
          const gy = (Y - corrimiento) / escala;
          if (SEGMENTOS.some((s) => distancia(gx, gy, s) <= GROSOR / 2)) trazo++;
        }
      }
      const i = (y * tam + x) * 4;
      if (fondo === 0) continue;
      for (let c = 0; c < 3; c++) {
        rgba[i + c] = Math.round((FONDO[c] * (fondo - trazo) + TRAZO[c] * trazo) / fondo);
      }
      rgba[i + 3] = Math.round((fondo / total) * 255);
    }
  }
  return rgba;
}

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function bloque(tipo, datos) {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "ascii"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

function png(tam, rgba) {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(tam, 0);
  cabecera.writeUInt32BE(tam, 4);
  cabecera[8] = 8;   // bits por canal
  cabecera[9] = 6;   // RGBA
  const fila = tam * 4 + 1;
  const crudo = Buffer.alloc(fila * tam);
  for (let y = 0; y < tam; y++) {
    crudo[y * fila] = 0;   // sin filtro
    Buffer.from(rgba.buffer, y * tam * 4, tam * 4).copy(crudo, y * fila + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloque("IHDR", cabecera),
    bloque("IDAT", deflateSync(crudo, { level: 9 })),
    bloque("IEND", Buffer.alloc(0))
  ]);
}

const ICONOS = [
  { archivo: "icono-192.png", tam: 192, margen: 0, redondeo: 5 / 32 },
  { archivo: "icono-512.png", tam: 512, margen: 0, redondeo: 5 / 32 },
  // Zona segura del maskable: un círculo del 80 %. El dibujo queda adentro.
  { archivo: "icono-maskable-512.png", tam: 512, margen: 0.1, redondeo: 0 },
  { archivo: "apple-touch-icon.png", tam: 180, margen: 0.08, redondeo: 0 }
];

for (const { archivo, tam, margen, redondeo } of ICONOS) {
  writeFileSync(path.join(destino, archivo), png(tam, dibujar(tam, { margen, redondeo })));
  console.log(`listo: apps/pwa/public/${archivo}`);
}

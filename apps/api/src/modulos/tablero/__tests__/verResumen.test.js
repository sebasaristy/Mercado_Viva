import { test } from "node:test";
import assert from "node:assert/strict";
import { crearVerResumen } from "../casos-uso/VerResumen.js";

const conDatos = (hoy, ayerMismaHora) => ({
  async resumen() {
    return { hoy: { ventas: hoy }, ayer: { ventas: 999999, ventasALaMismaHora: ayerMismaHora } };
  }
});

test("compara contra ayer a esta misma hora, no contra el día completo", async () => {
  const ver = crearVerResumen({ repositorio: conDatos(112000, 100000), zona: "America/Bogota" });
  const r = await ver("t-1");
  assert.equal(r.comparacion.variacionPct, 12);
});

test("sin ventas ayer a esta hora no inventa un porcentaje", async () => {
  const ver = crearVerResumen({ repositorio: conDatos(50000, 0), zona: "America/Bogota" });
  const r = await ver("t-1");
  assert.equal(r.comparacion.variacionPct, null);
});

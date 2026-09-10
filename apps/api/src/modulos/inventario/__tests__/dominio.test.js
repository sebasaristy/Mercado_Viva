import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { Movimiento } from "../dominio/Movimiento.js";
import { ReglaViolada } from "../dominio/errores.js";

// El dominio no toca la base ni la red, así que estas pruebas corren en milisegundos.
const arroz = { id: "p-1", nombre: "Arroz Diana 500 g", unidad: "unidad" };
const banano = { id: "p-2", nombre: "Banano", unidad: "kg" };

const base = {
  id: "01a08c56-f6dd-75c1-b455-9a85929daf3b",
  tenantId: "t-1",
  usuarioId: "u-1",
  creadoEn: "2026-09-10T15:00:00Z"
};

describe("Movimiento", () => {
  test("el signo lo pone el tipo, no quien llama", () => {
    const entrada = Movimiento.crear({ ...base, producto: arroz, tipo: "ENTRADA", cantidad: 20 });
    const merma = Movimiento.crear({
      ...base, producto: arroz, tipo: "MERMA", cantidad: 3, motivo: "vencido"
    });

    assert.equal(entrada.delta, 20);
    assert.equal(merma.delta, -3);
  });

  test("mandar cantidad negativa no invierte el sentido del movimiento", () => {
    // Esto es lo que protege la regla: una MERMA jamás puede terminar sumando.
    assert.throws(
      () => Movimiento.crear({
        ...base, producto: arroz, tipo: "MERMA", cantidad: -5, motivo: "x"
      }),
      (e) => e instanceof ReglaViolada && e.codigo === "cantidad_invalida"
    );
  });

  test("un producto por unidad no acepta decimales", () => {
    assert.throws(
      () => Movimiento.crear({ ...base, producto: arroz, tipo: "ENTRADA", cantidad: 2.5 }),
      (e) => e.codigo === "decimales_en_unidad"
    );
  });

  test("un producto por kilo sí acepta decimales", () => {
    const m = Movimiento.crear({ ...base, producto: banano, tipo: "ENTRADA", cantidad: 2.5 });
    assert.equal(m.delta, 2.5);
  });

  test("la merma exige motivo; la entrada no", () => {
    assert.throws(
      () => Movimiento.crear({ ...base, producto: arroz, tipo: "MERMA", cantidad: 1 }),
      (e) => e.codigo === "motivo_requerido"
    );
    assert.doesNotThrow(
      () => Movimiento.crear({ ...base, producto: arroz, tipo: "ENTRADA", cantidad: 1 })
    );
  });

  test("un tipo inventado se rechaza con un mensaje que dice cuáles valen", () => {
    assert.throws(
      () => Movimiento.crear({ ...base, producto: arroz, tipo: "REGALO", cantidad: 1 }),
      (e) => e.codigo === "tipo_desconocido" && e.message.includes("ENTRADA")
    );
  });

  test("sabe cuáles tipos son seguros sin red", () => {
    const salida = Movimiento.crear({ ...base, producto: arroz, tipo: "SALIDA", cantidad: 1 });
    const ajuste = Movimiento.crear({
      ...base, producto: arroz, tipo: "AJUSTE", cantidad: 1, motivo: "conteo"
    });

    // Los deltas son conmutativos: da igual el orden en que lleguen de la cola.
    assert.equal(salida.seguroSinRed, true);
    // Los valores absolutos no: necesitan una sesión abierta en el servidor.
    assert.equal(ajuste.seguroSinRed, false);
  });
});

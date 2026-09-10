import { test } from "node:test";
import assert from "node:assert/strict";
import { signoDe } from "@mv/compartido";

test("el signo lo decide el tipo, no quien llama", () => {
  assert.equal(signoDe("ENTRADA"), 1);
  assert.equal(signoDe("SALIDA"), -1);
  assert.equal(signoDe("MERMA"), -1);
});

// Pendiente: pruebas de registrarMovimiento contra una base de prueba.
// El caso que no puede faltar es el reintento: mandar el mismo id dos veces
// tiene que dejar un solo movimiento y una sola aplicación del delta.

## Qué hace

<!-- Una o dos frases. Qué cambia para el usuario o para el que llame la API. -->

## Por qué

<!-- Si resuelve algo de ARQUITECTURA.md o docs/decisiones.md, enlázalo. -->

## Cómo lo probé

<!-- Qué corriste. Si no probaste nada, dilo: es peor descubrirlo en el merge. -->

## Antes de pedir revisión

- [ ] `npm run lint` pasa
- [ ] `npm test` pasa
- [ ] No importé otro módulo por dentro (solo por su `index.js`)
- [ ] No hice JOIN contra tablas de otro módulo
- [ ] Si toqué `existencias`, va dentro de una transacción y con `+delta`, no `= X`
- [ ] Si agregué una migración, es nueva; no edité una ya aplicada

# Estructura del repositorio

Un repo, un lenguaje (JavaScript), tres cosas que se despliegan por separado: el servidor, la PWA
y las migraciones de la base de datos.

```
mercado-viva/
├── apps/
│   ├── api/                    servidor Node — todas las reglas viven aquí
│   └── pwa/                    React + Vite, instalable, funciona sin red
├── packages/
│   └── compartido/             código que usan los dos lados
├── db/
│   ├── migraciones/
│   └── semillas/
├── docs/
└── package.json                workspaces
```

Se usa `npm workspaces`. Para arrancar todo en local:

```bash
npm install
npm run dev          # levanta api en :3000 y pwa en :5173
```

---

## apps/api

```
apps/api/src/
├── modulos/
│   ├── catalogo/
│   ├── inventario/
│   ├── disponibilidad/
│   ├── conteo/
│   └── pedidos/
├── plataforma/
│   ├── db.js                   pool de conexiones a Postgres
│   ├── transaccion.js          helper para BEGIN/COMMIT
│   ├── idempotencia.js         middleware de Idempotency-Key
│   ├── auth.js                 verificación del token de Supabase
│   ├── errores.js
│   └── log.js
├── app.js                      arma express y monta los módulos
└── server.js                   arranca el proceso
```

Cada módulo tiene la misma forma por dentro. Ejemplo con `inventario`:

```
modulos/inventario/
├── index.js                    ← lo único que otros módulos pueden importar
├── rutas.js                    endpoints HTTP, sin lógica
├── servicio.js                 las reglas: validar, decidir, orquestar
├── repo.js                     SQL. Nada de reglas aquí
├── esquemas.js                 validación de lo que entra y lo que sale
└── __tests__/
```

### Reglas

**1. `index.js` es la única puerta.**
Desde otro módulo se importa `../inventario`, nunca `../inventario/repo.js`. Si algo no está
exportado en el `index.js`, es privado del módulo. Está puesto como regla de ESLint
(`no-restricted-imports`), así que si alguien se salta la puerta, el lint lo revienta.

**2. Cada tabla tiene un módulo dueño y nadie más la toca.**
Si `pedidos` necesita saber el stock de un producto, le pregunta a `disponibilidad`. No hace un
JOIN contra `existencias`. Es la regla más fácil de romper sin darse cuenta y la que más caro sale
después.

| Módulo | Tablas que le pertenecen |
|---|---|
| `catalogo` | `productos`, `unidades`, `equivalencias` |
| `inventario` | `movimientos`, `existencias`, `ubicaciones` |
| `disponibilidad` | `reservas`, `colchones` |
| `conteo` | `sesiones_conteo`, `zonas`, `conteo_lineas` |
| `pedidos` | `pedidos`, `pedido_lineas`, `pedido_eventos` |

**3. Las dependencias van en una sola dirección.**

```
pedidos ──▶ disponibilidad ──▶ inventario ──▶ catalogo
conteo  ──────────────────────▶
```

`catalogo` no importa a nadie. Si aparece una flecha para atrás, algo está mal modelado —
normalmente significa que hace falta un evento, no un import.

**4. Todo lo que toca `existencias` va dentro de una transacción.**
`repo.js` recibe el cliente de la transacción, no lo crea. El que abre y cierra es `servicio.js`
usando `plataforma/transaccion.js`. Y nunca se escribe `cantidad = X`: siempre
`cantidad = cantidad + $delta`, con `SELECT ... FOR UPDATE` sobre la fila.

**5. La PWA no habla con Supabase directo.**
Siempre pasa por la API. La PWA solo conoce la **anon key**; la **service_role**, que se
salta RLS por completo, vive únicamente en el servidor. Si el navegador pudiera escribir
en las tablas, las reglas del servidor sobrarían.

**6. Las escrituras que tienen que ser atómicas van como funciones de Postgres.**
La API entra por la REST de Supabase, y esa REST no tiene transacciones de varias
sentencias: cada llamada es la suya. Cuando una operación son dos escrituras que van
juntas o ninguna —el asiento del movimiento y el delta de la proyección— la transacción
se mueve adentro de la base y se llama con `supabase.rpc()`. Ver
`db/migraciones/006_funciones_inventario.sql` y la decisión 007 en `docs/decisiones.md`.

---

## apps/pwa

```
apps/pwa/src/
├── pantallas/
│   ├── bodega/                 entradas de proveedor, merma, traslados
│   ├── conteo/                 sesión de conteo por zona asignada
│   └── picking/                recolección y marca de faltantes
├── local/
│   ├── db.js                   Dexie: esquema de la base local
│   ├── cola.js                 outbox — encolar, reintentar, marcar enviado
│   ├── sync.js                 cuándo se dispara el envío
│   └── estado.js               "hay 4 pendientes", "última sync 12:03"
├── api/
│   └── cliente.js              fetch + Idempotency-Key + reintento
├── componentes/
│   ├── Escaner.jsx             input HID + cámara como respaldo
│   ├── BotonGrande.jsx
│   └── BarraSync.jsx           siempre visible: cuántas cosas faltan por subir
├── sw.js                       service worker (vite-plugin-pwa)
└── main.jsx
```

Lo importante está en `local/`. El resto de la app **nunca llama a la API directamente**: escribe en
Dexie y sigue. `sync.js` es el único que habla con el servidor.

```
pantalla → local/db.js → local/cola.js → local/sync.js → api/cliente.js → servidor
```

Eso es lo que hace que la pantalla responda igual con red y sin red: siempre está escribiendo local.

`sync.js` se dispara con: Background Sync cuando el navegador lo soporta, evento `online`,
`visibilitychange` al volver a la app, y un intervalo de respaldo. No se confía en
`navigator.onLine` — miente. Se considera que hay red cuando una petición responde, no antes.

`BarraSync` no es decoración. Si algo lleva rato sin subir, el usuario tiene que verlo. Nada se
puede perder en silencio.

---

## packages/compartido

```
packages/compartido/src/
├── reglas/
│   ├── movimiento.js           qué es un movimiento válido
│   └── cantidad.js             no negativa, decimales según unidad
├── codigos/
│   ├── ean.js                  validación y dígito verificador
│   └── balanza.js              EAN-13 prefijo 2x → extrae peso o precio
├── ids.js                      UUIDv7
└── index.js
```

Está aquí lo que tiene que dar el mismo resultado en la tablet y en el servidor. La PWA valida para
avisarle al usuario de una vez; el servidor valida porque no se le cree a nadie. Misma función, dos
motivos distintos.

`ids.js` importa: el UUID se genera **cuando se crea el movimiento en la tablet**, no cuando se
envía. Es lo que hace que reintentar no duplique. Va como `Idempotency-Key` y en la tabla hay un
`UNIQUE` sobre esa columna.

---

## db

```
db/
├── migraciones/
│   ├── 001_catalogo.sql
│   ├── 002_inventario.sql
│   ├── 003_disponibilidad.sql
│   ├── 004_conteo.sql
│   └── 005_pedidos.sql
└── semillas/
    ├── productos_demo.sql      ~80 productos para el demo
    └── movimientos_demo.sql
```

Una migración por módulo, numeradas. El orden no es casualidad: es el mismo de las dependencias.

Las migraciones se corren con `npm run db:migrate`. Nunca se edita una migración ya aplicada —
se crea la siguiente.

Todas las tablas llevan `tenant_id` desde la primera migración, aunque en el MVP haya una sola
sede. Agregarlo después significa migrar todo con datos adentro.

---

## Convenciones

- Archivos y carpetas en minúscula, sin acentos, separados con `_` cuando hace falta.
- Componentes React en `PascalCase.jsx`. Todo lo demás en `camelCase.js`.
- Nombres de dominio en español (`movimientos`, `existencias`), porque así se llaman en el negocio
  y en la sustentación. Los términos técnicos se quedan en inglés (`repo`, `router`, `hook`).
- Un `console.log` en `main` no pasa el lint. Para eso está `plataforma/log.js`.

---

## Por qué no está partido en servicios

Se evaluó y se descartó. Tres personas, un semestre, y una carga que cabe de sobra en un proceso:
partirlo ahora solo agrega despliegues, latencia entre servicios y transacciones distribuidas, sin
resolver nada que hoy duela.

El costo de esperar es bajo justamente por las reglas de arriba. Cada módulo ya tiene una puerta
única, sus propias tablas y dependencias en una sola dirección, así que sacar `inventario` a su
propio proceso el día que haga falta es cambiar los imports por llamadas HTTP dentro de su
`index.js`. Nada de lo que está afuera se entera.

---

## Lo que todavía no está

- `pedidos` está en el esqueleto pero solo con lo mínimo para reservar. El pedido completo (con QR
  y línea de tiempo) es del siguiente incremento.
- No hay módulo de precios ni de promociones. El precio hoy vive en `catalogo` como un campo.
- `movimientos` tiene la columna `lote_id` y está siempre en `null`. Es a propósito: activar lotes
  y vencimientos después es llenar una tabla, no migrar el libro.
- Falta decidir dónde vive el cálculo del colchón aprendido. Por ahora es una constante por
  categoría en `disponibilidad/colchon.js`; cuando haya datos del modo sombra se vuelve un job.

---

## Cómo está armado un módulo por dentro

`inventario` es la referencia. Los demás módulos se van moviendo a esta forma
a medida que se implementan.

```
modulos/inventario/
├── index.js                   la puerta. Aquí, y solo aquí, se elige
│                              qué implementación concreta se usa
├── fabrica.js                 arma el módulo con las dependencias que reciba
│
├── dominio/                   las reglas. Cero imports de afuera del dominio
│   ├── Movimiento.js          qué es un movimiento válido y con qué signo entra
│   ├── TipoMovimiento.js      la tabla de tipos
│   └── errores.js             errores que no saben qué es un código HTTP
│
├── casos-uso/                 orquestan: piden, deciden con el dominio, guardan
│   ├── RegistrarMovimiento.js
│   └── ConsultarInventario.js
│
├── puertos/                   los contratos, declarados por quien los USA
│   ├── RepositorioInventario.js
│   └── PuertoCatalogo.js
│
├── adaptadores/               implementaciones de los puertos
│   ├── RepositorioPostgres.js    el real. Aquí, y solo aquí, hay SQL
│   └── RepositorioEnMemoria.js   el de las pruebas
│
├── http/                      traduce peticiones a casos de uso y errores a códigos
│   ├── rutas.js
│   └── esquemas.js
└── __tests__/
```

Las dependencias apuntan siempre hacia adentro: `http → casos-uso → dominio`, y
los adaptadores dependen de los puertos, nunca al revés. El dominio no importa
nada de las otras capas.

### Qué se gana con esto

No es teoría: es que **las pruebas corren sin base de datos**. El mismo caso de uso
que corre en producción se prueba contra `RepositorioEnMemoria`, en milisegundos,
sin Supabase levantado. Si los casos de uso importaran el repositorio en vez de
recibirlo, no habría forma de hacerlo.

Lo demás sale de ahí:

- **Una responsabilidad por capa.** El dominio decide, el caso de uso orquesta, el
  adaptador habla SQL, las rutas traducen HTTP. Cambiar Postgres por otra cosa toca
  un archivo.
- **Abierto a extensión.** Agregar un tipo de movimiento es agregar una fila en
  `TipoMovimiento.js`. No hay ningún `switch` por tipo regado en los casos de uso.
- **Implementaciones intercambiables.** `__tests__/contratoRepositorio.test.js` corre
  la misma batería contra memoria y contra Postgres. Si una pasa y la otra no, el
  diseño se rompió y las demás pruebas dejarían de significar algo.
- **Contratos chicos.** El puerto de catálogo tiene un método, porque es lo único que
  inventario necesita. `index.js` recorta lo que expone `catalogo` para que el módulo
  no pueda empezar a usar, sin querer, cosas que no pactó.

## Entorno de desarrollo

```bash
npm run doctor    # revisa node, dependencias, .env, conexión, tablas y semillas
npm run dev       # api en :3000, pwa en :5173
```

`npm run doctor` es lo primero que hay que correr cuando algo no arranca. Dice qué
falta y cómo arreglarlo, en vez de dejar que reviente a mitad de una petición.

**Panel de desarrollo: `http://localhost:3000/dev`**

Se monta solo fuera de producción. Muestra, en vivo:

- si la base conecta y qué migraciones están aplicadas
- las 13 tablas con cuántas filas tiene cada una
- los tres números por producto: teórico, reservado, colchón y disponible
- los últimos movimientos del libro
- todas las rutas montadas, sacadas del propio Express
- las últimas peticiones con estado, duración e `Idempotency-Key`

Mientras `npm run dev` corre, cada petición también sale en la terminal con su
código de estado y cuánto tardó.

`AUTH_DESACTIVADA=true` en el `.env` salta la verificación del token para poder
probar endpoints antes de montar el login. `config.js` impide que quede encendido
fuera de desarrollo.

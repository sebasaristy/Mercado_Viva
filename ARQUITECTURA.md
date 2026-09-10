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
Siempre pasa por la API. Supabase se usa como Postgres administrado + emisor de tokens, nada más.
Si el navegador pudiera escribir en las tablas, las reglas del servidor sobrarían.

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

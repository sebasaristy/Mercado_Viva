# Decisiones

Registro corto de por qué las cosas están como están. Se agrega al final, no se reescribe.

## 001 — Un solo proceso, no servicios separados
Tres personas y un semestre. Partirlo hoy agrega despliegues, latencia y transacciones
distribuidas sin resolver nada que duela. Las reglas de ARQUITECTURA.md mantienen barata
la salida: cada módulo ya tiene puerta única y tablas propias.

## 002 — JavaScript en los dos lados
Para no aprender dos lenguajes, para que cualquiera pueda ayudar en cualquier parte, y
para escribir una sola vez las reglas que corren en la tablet y en el servidor
(`packages/compartido`).

## 003 — La PWA no toca Supabase directo
Supabase queda como Postgres administrado más emisor de tokens. Si el navegador pudiera
escribir en las tablas, las reglas del servidor sobrarían.

## 004 — El id lo genera el dispositivo
UUIDv7 creado al ocurrir la operación, no al enviarla. Es el primary key en la base, así
que reintentar el envío no duplica. Sin esto no hay offline confiable.

## 005 — El stock es un libro, no un campo
`movimientos` es append-only y `existencias` es una proyección. Cuesta un poco más al
escribir y permite responder por qué cambió el número, que es lo que nadie puede hoy.

## 006 — Colchón por categoría, a ojo, por ahora
No hay datos para calcularlo. Se arranca con constantes en
`disponibilidad/colchon.js` y se reemplaza cuando el modo sombra dé tres semanas de
discrepancias reales.

## 007 — Todo entra por la REST de Supabase, no por conexión directa a Postgres
La API usa `@supabase/supabase-js` con la clave **service_role**. No hay `pg`,
no hay `DATABASE_URL`. La PWA usa la **anon key** y siempre pasa por la API.

Consecuencia que hubo que resolver: **la REST no tiene transacciones de varias
sentencias**. Cada llamada es su propia transacción. Registrar un movimiento son
dos escrituras que tienen que ir juntas o ninguna (el asiento en el libro y el
delta en la proyección); partido en dos llamadas, si la segunda falla el libro y
las existencias quedan desalineados y no hay forma de saberlo.

La transacción se movió adentro de la base: el cuerpo de una función plpgsql ya
es atómico. Las escrituras críticas son funciones y se llaman con `supabase.rpc()`:

| Función | Por qué no puede ser una llamada REST normal |
|---|---|
| `registrar_movimiento` | asiento + delta tienen que ir juntos |
| `reservar_lineas` | mirar el disponible y apartar en un solo paso, con la fila bloqueada |
| `disponible_de` | lee la vista de los tres números |
| `movido_durante_conteo` | compara contra `abierta_en` de la sesión |
| `congelar_precios_pedido` | es un update con join, que la REST no expresa |

Todas están en `db/migraciones/006_funciones_inventario.sql`, con
`security definer` y permiso solo para `service_role`.

## 008 — La clave service_role nunca sale del servidor
Se salta RLS por completo. Vive únicamente en `apps/api`, en una variable de
entorno. Si llegara al navegador, cualquiera podría reescribir el inventario
saltándose todas las reglas. La PWA solo conoce la anon key, y con ella no puede
escribir nada del inventario.

## 009 — Una venta escribe en tablas de tres módulos, a propósito
`registrar_venta` escribe en `ventas` (módulo ventas), `movimientos` y `existencias`
(módulo inventario) dentro de una sola transacción. Rompe la regla de "cada tabla
tiene un solo dueño", y se acepta porque la alternativa es peor: una venta de cinco
productos hecha en cinco llamadas puede quedar a medias, cobrando tres y descontando
dos. En una caja eso no se puede permitir.

La excepción queda acotada a la función SQL. En Node, ventas no importa nada de
inventario. `resumen_tablero` también cruza módulos, pero solo lee.

## 010 — El precio lo pone la base, nunca la caja
La caja manda producto y cantidad. El precio y el costo salen de `productos` en el
momento de la venta y quedan copiados en `venta_lineas`. Así nadie puede vender más
barato de lo que dice el catálogo, y subir un precio mañana no cambia las ventas de hoy.

## 011 — La venta nunca se bloquea por stock
Si el sistema dice que no hay pero el cliente tiene el producto en la mano, el que
está mal es el sistema. Se vende, y la venta devuelve una alerta para contar ese
producto. Bloquearla solo manda al cliente a otra tienda.

## 012 — Modo local: Postgres dentro del proceso, para trabajar sin claves
`npm run dev:local` corre la API contra PGlite (Postgres compilado a WebAssembly)
con 14 días de ventas de demostración. Aplica exactamente las mismas migraciones que
van a Supabase, y las mismas funciones se prueban en `db/__tests__` contra ese
Postgres real antes de pegarlas allá. Sirve para que cualquiera del equipo trabaje
sin configurar nada y para que el SQL no se pruebe "a ver si funciona" en producción.

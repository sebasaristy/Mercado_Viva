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

# Mercado Viva — inventario confiable

MVP de inventario para compra digital. La promesa que sostiene el sistema:
antes de confirmar un pedido se verifica la disponibilidad real y, si no alcanza,
se ofrece una alternativa en vez de cancelar.

- Estructura del repo y sus reglas: [ARQUITECTURA.md](ARQUITECTURA.md)
- Contexto del caso y decisiones: `docs/`

## Arrancar

```bash
cp .env.example .env      # llenar con los datos de Supabase
npm install
npm run db:migrate
npm run db:seed
npm run dev               # api :3000 — pwa :5173
```

## Probar sin configurar nada

```bash
npm install
npm run dev:local         # API con Postgres local y datos de demo, PWA en :5173
```

Abre http://localhost:5173. Para empezar de cero: `npm run datos-local:reiniciar`.

## Con Supabase

```bash
npm run db:sql            # genera db/aplicar_en_supabase.sql
```

Pega ese archivo completo en Supabase → SQL Editor → Run (se puede correr más de
una vez), llena el `.env` y verifica con `npm run doctor`.

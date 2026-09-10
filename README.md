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

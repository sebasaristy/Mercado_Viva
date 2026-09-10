-- Módulo dueño: catalogo
create extension if not exists "pgcrypto";

create table productos (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null,
  codigo_barras   text,
  nombre          text not null,
  categoria       text not null,
  unidad          text not null default 'unidad' check (unidad in ('unidad', 'kg')),
  factor_empaque  numeric not null default 1,   -- caja de 12 -> 12 unidades base
  precio          numeric(12,2) not null,
  costo           numeric(12,2),
  activo          boolean not null default true,
  creado_en       timestamptz not null default now()
);

create unique index productos_codigo_uq
  on productos (tenant_id, codigo_barras)
  where codigo_barras is not null;

create index productos_tenant_idx on productos (tenant_id, categoria);

-- Grafo de reemplazos. Se usa cuando falta producto al recolectar.
create table equivalencias (
  producto_id     uuid not null references productos(id) on delete cascade,
  equivalente_id  uuid not null references productos(id) on delete cascade,
  score           numeric not null default 1,
  primary key (producto_id, equivalente_id),
  check (producto_id <> equivalente_id)
);

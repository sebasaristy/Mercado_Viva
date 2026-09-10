-- Módulo dueño: inventario
create table ubicaciones (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null,
  sede       text not null,
  zona       text not null,          -- 'pasillo 1-4', 'bodega fría'
  nombre     text not null
);
create index ubicaciones_tenant_idx on ubicaciones (tenant_id, sede);

create type tipo_movimiento as enum
  ('ENTRADA', 'SALIDA', 'MERMA', 'TRASLADO', 'CONTEO', 'AJUSTE');

-- El libro. Append-only: no se hace update ni delete sobre esta tabla.
-- El id lo genera la tablet (UUIDv7) al crear el movimiento, no al enviarlo:
-- por eso el primary key es la clave de idempotencia. Reintentar es gratis.
create table movimientos (
  id             uuid primary key,
  tenant_id      uuid not null,
  producto_id    uuid not null references productos(id),
  ubicacion_id   uuid references ubicaciones(id),
  tipo           tipo_movimiento not null,
  cantidad       numeric not null,        -- delta con signo, en unidad base
  motivo         text,
  referencia     text,                    -- id de pedido, factura de proveedor, sesión de conteo
  lote_id        uuid,                    -- siempre null en el MVP (ver ARQUITECTURA.md)
  usuario_id     uuid not null,
  creado_en      timestamptz not null,    -- cuándo ocurrió, según la tablet
  registrado_en  timestamptz not null default now()  -- cuándo llegó al servidor
);

create index movimientos_producto_idx
  on movimientos (tenant_id, producto_id, creado_en desc);

-- Proyección del libro. No es la verdad: es la suma cacheada para no recorrer
-- el libro entero en cada consulta. Se actualiza en la misma transacción.
create table existencias (
  tenant_id       uuid not null,
  producto_id     uuid not null references productos(id),
  cantidad        numeric not null default 0,
  actualizado_en  timestamptz not null default now(),
  primary key (tenant_id, producto_id)
);

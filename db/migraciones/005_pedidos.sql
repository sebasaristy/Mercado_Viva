-- Módulo dueño: pedidos
-- En el MVP solo lo mínimo para reservar y recolectar.
-- El pedido completo (QR, devoluciones, línea de tiempo) es del siguiente incremento.
create table pedidos (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           uuid not null,
  cliente_id          uuid not null,
  sede                text not null,
  estado              text not null default 'borrador'
                        check (estado in ('borrador', 'confirmado', 'en_picking',
                                          'listo', 'entregado', 'cancelado')),
  regla_sustitucion   text not null default 'equivalente'
                        check (regla_sustitucion in ('equivalente', 'mismo_tamano',
                                                     'no_sustituir', 'llamarme')),
  creado_en           timestamptz not null default now()
);

create table pedido_lineas (
  id             uuid primary key default gen_random_uuid(),
  pedido_id      uuid not null references pedidos(id) on delete cascade,
  producto_id    uuid not null references productos(id),
  cantidad       numeric not null check (cantidad > 0),
  precio_unit    numeric(12,2) not null,   -- foto del precio al confirmar
  costo_unit     numeric(12,2),            -- foto del costo al confirmar
  cantidad_picada numeric,
  estado_linea   text not null default 'pedida'
                   check (estado_linea in ('pedida', 'picada', 'sustituida', 'no_disponible')),
  sustituto_de   uuid references pedido_lineas(id)
);

create table pedido_eventos (
  id         bigserial primary key,
  pedido_id  uuid not null references pedidos(id) on delete cascade,
  tipo       text not null,
  actor_id   uuid,
  datos      jsonb not null default '{}',
  ocurrio_en timestamptz not null default now()
);
create index pedido_eventos_idx on pedido_eventos (pedido_id, ocurrio_en);

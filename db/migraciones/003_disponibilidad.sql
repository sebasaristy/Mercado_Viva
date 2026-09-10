-- Módulo dueño: disponibilidad
-- Unidades que NO se prometen, porque el teórico nunca es exacto.
create table colchones (
  tenant_id       uuid not null,
  producto_id     uuid not null references productos(id),
  unidades        numeric not null default 0,
  origen          text not null default 'categoria'
                    check (origen in ('categoria', 'aprendido')),
  actualizado_en  timestamptz not null default now(),
  primary key (tenant_id, producto_id)
);

create table reservas (
  id           uuid primary key default gen_random_uuid(),
  tenant_id    uuid not null,
  producto_id  uuid not null references productos(id),
  pedido_id    uuid not null,
  cantidad     numeric not null check (cantidad > 0),
  estado       text not null default 'activa'
                 check (estado in ('activa', 'consumida', 'liberada')),
  expira_en    timestamptz not null,
  creado_en    timestamptz not null default now()
);

create index reservas_activas_idx
  on reservas (tenant_id, producto_id)
  where estado = 'activa';

-- Los tres números: teórico, reservado, colchón. Lo que se promete es la resta.
create view v_disponible as
select
  e.tenant_id,
  e.producto_id,
  e.cantidad                                as teorico,
  coalesce(r.reservado, 0)                  as reservado,
  coalesce(c.unidades, 0)                   as colchon,
  greatest(e.cantidad - coalesce(r.reservado, 0) - coalesce(c.unidades, 0), 0) as disponible
from existencias e
left join colchones c
  on c.tenant_id = e.tenant_id and c.producto_id = e.producto_id
left join (
  select tenant_id, producto_id, sum(cantidad) as reservado
    from reservas
   where estado = 'activa' and expira_en > now()
   group by tenant_id, producto_id
) r on r.tenant_id = e.tenant_id and r.producto_id = e.producto_id;

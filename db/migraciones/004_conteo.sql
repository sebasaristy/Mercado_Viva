-- Módulo dueño: conteo
create table sesiones_conteo (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null,
  sede        text not null,
  estado      text not null default 'abierta'
                check (estado in ('abierta', 'cerrada', 'cancelada')),
  abierta_por uuid not null,
  abierta_en  timestamptz not null default now(),
  cerrada_en  timestamptz
);

-- El unique de abajo es la regla completa de concurrencia del conteo:
-- una ubicación pertenece a un solo contador dentro de una sesión.
-- Dos personas no pueden contar lo mismo porque la base no las deja.
create table zonas_conteo (
  id            uuid primary key default gen_random_uuid(),
  sesion_id     uuid not null references sesiones_conteo(id) on delete cascade,
  ubicacion_id  uuid not null references ubicaciones(id),
  usuario_id    uuid not null,
  estado        text not null default 'asignada'
                  check (estado in ('asignada', 'en_curso', 'terminada')),
  unique (sesion_id, ubicacion_id)
);

create table conteo_lineas (
  id                uuid primary key,   -- UUIDv7 de la tablet
  zona_id           uuid not null references zonas_conteo(id) on delete cascade,
  producto_id       uuid not null references productos(id),
  cantidad_contada  numeric not null check (cantidad_contada >= 0),
  snapshot_teorico  numeric not null,   -- lo que había al abrir la sesión
  contado_en        timestamptz not null,
  unique (zona_id, producto_id)
);

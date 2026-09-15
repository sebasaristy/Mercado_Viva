-- Módulo dueño: identidad
--
-- Usuarios con cédula y contraseña, y las sesiones de cada equipo.
--
-- La contraseña nunca llega aquí: llega su huella scrypt, calculada en la API.
-- El token de sesión tampoco: se guarda su sha256. Si alguien se lleva una
-- copia de estas tablas, no puede entrar con nada de lo que hay adentro.
--
-- Se puede pegar más de una vez en Supabase (if not exists / create or replace).

create table if not exists usuarios (
  id                  uuid primary key,
  tenant_id           uuid not null,
  cedula              text not null check (cedula ~ '^[0-9]{5,12}$'),
  nombre              text not null check (length(btrim(nombre)) between 2 and 80),
  rol                 text not null check (rol in ('administrador', 'cajero', 'bodega')),
  clave_hash          text not null,
  -- Encendido cuando el administrador pone la contraseña: la persona la
  -- cambia al entrar, y así el administrador nunca conoce la definitiva.
  debe_cambiar_clave  boolean not null default true,
  activo              boolean not null default true,
  intentos_fallidos   int not null default 0,
  bloqueado_hasta     timestamptz,
  ultimo_ingreso      timestamptz,
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  unique (tenant_id, cedula)
);

create table if not exists sesiones (
  id               uuid primary key,
  usuario_id       uuid not null references usuarios(id) on delete cascade,
  token_hash       text not null unique,
  agente           text,
  creada_en        timestamptz not null default now(),
  expira_en        timestamptz not null,
  revocada_en      timestamptz,
  motivo_revocada  text
);

create index if not exists sesiones_usuario_activas_idx
  on sesiones (usuario_id) where revocada_en is null;

alter table usuarios enable row level security;
alter table sesiones enable row level security;

-- Lo que se puede mostrar de un usuario. Sin la huella de la contraseña.
create or replace function usuario_publico(u usuarios)
returns jsonb
language sql
immutable
as $$
  select jsonb_build_object(
    'id', u.id,
    'tenantId', u.tenant_id,
    'cedula', u.cedula,
    'nombre', u.nombre,
    'rol', u.rol,
    'activo', u.activo,
    'debeCambiarClave', u.debe_cambiar_clave,
    'ultimoIngreso', u.ultimo_ingreso,
    'creadoEn', u.creado_en
  );
$$;

create or replace function hay_usuarios(p_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from usuarios where tenant_id = p_tenant_id);
$$;

-- Para verificar la contraseña en la API. Es la única que devuelve la huella.
create or replace function usuario_para_ingresar(p_tenant_id uuid, p_cedula text default null, p_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  u usuarios;
begin
  select * into u from usuarios
   where tenant_id = p_tenant_id
     and (cedula = p_cedula or id = p_id)
   limit 1;
  if not found then
    return null;
  end if;
  return usuario_publico(u) || jsonb_build_object(
    'claveHash', u.clave_hash,
    'bloqueadoHasta', u.bloqueado_hasta
  );
end;
$$;

-- Cuenta el intento. Al quinto fallo seguido bloquea la cuenta 15 minutos:
-- probar contraseñas a mano deja de ser posible.
create or replace function registrar_ingreso(
  p_usuario_id       uuid,
  p_exito            boolean,
  p_max_intentos     int default 5,
  p_minutos_bloqueo  int default 15
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u usuarios;
begin
  if p_exito then
    update usuarios
       set intentos_fallidos = 0, bloqueado_hasta = null, ultimo_ingreso = now()
     where id = p_usuario_id;
    return jsonb_build_object('bloqueadoHasta', null, 'restantes', p_max_intentos);
  end if;

  update usuarios
     set intentos_fallidos = case
           when intentos_fallidos + 1 >= p_max_intentos then 0
           else intentos_fallidos + 1
         end,
         bloqueado_hasta = case
           when intentos_fallidos + 1 >= p_max_intentos
             then now() + make_interval(mins => p_minutos_bloqueo)
           else bloqueado_hasta
         end
   where id = p_usuario_id
  returning * into u;

  return jsonb_build_object(
    'bloqueadoHasta', u.bloqueado_hasta,
    'restantes', greatest(p_max_intentos - u.intentos_fallidos, 0)
  );
end;
$$;

create or replace function crear_sesion(
  p_id          uuid,
  p_usuario_id  uuid,
  p_token_hash  text,
  p_expira_en   timestamptz,
  p_agente      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Limpieza de paso: las vencidas hace más de una semana ya no sirven ni para auditar.
  delete from sesiones
   where usuario_id = p_usuario_id and expira_en < now() - interval '7 days';

  insert into sesiones (id, usuario_id, token_hash, expira_en, agente)
  values (p_id, p_usuario_id, p_token_hash, p_expira_en, left(p_agente, 200));

  return jsonb_build_object('ok', true, 'sesionId', p_id);
end;
$$;

-- Cambia el token de sesión por uno nuevo. Cada token sirve UNA vez.
--
-- Si llega un token que ya se usó, alguien lo copió: se cierran todas las
-- sesiones de ese usuario, la suya incluida, y le toca volver a entrar.
-- La excepción son los primeros segundos después de rotarlo, que es lo que
-- pasa cuando dos pestañas renuevan a la vez: eso no es un robo.
create or replace function rotar_sesion(
  p_token_hash  text,
  p_nuevo_id    uuid,
  p_nuevo_hash  text,
  p_expira_en   timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  s sesiones;
  u usuarios;
begin
  select * into s from sesiones where token_hash = p_token_hash for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'sesion_invalida');
  end if;

  if s.revocada_en is not null then
    if s.motivo_revocada = 'rotada' and s.revocada_en > now() - interval '20 seconds' then
      return jsonb_build_object('ok', false, 'error', 'carrera');
    end if;
    if s.motivo_revocada = 'rotada' then
      update sesiones
         set revocada_en = now(), motivo_revocada = 'token_reutilizado'
       where usuario_id = s.usuario_id and revocada_en is null;
      return jsonb_build_object('ok', false, 'error', 'sesion_reutilizada');
    end if;
    return jsonb_build_object('ok', false, 'error', 'sesion_cerrada');
  end if;

  if s.expira_en < now() then
    return jsonb_build_object('ok', false, 'error', 'sesion_vencida');
  end if;

  select * into u from usuarios where id = s.usuario_id;
  if not u.activo then
    update sesiones set revocada_en = now(), motivo_revocada = 'usuario_inactivo' where id = s.id;
    return jsonb_build_object('ok', false, 'error', 'usuario_inactivo');
  end if;

  update sesiones set revocada_en = now(), motivo_revocada = 'rotada' where id = s.id;
  insert into sesiones (id, usuario_id, token_hash, expira_en, agente)
  values (p_nuevo_id, s.usuario_id, p_nuevo_hash, p_expira_en, s.agente);

  return jsonb_build_object('ok', true, 'sesionId', p_nuevo_id, 'usuario', usuario_publico(u));
end;
$$;

create or replace function cerrar_sesion(p_token_hash text)
returns jsonb
language sql
security definer
set search_path = public
as $$
  with cerrada as (
    update sesiones set revocada_en = now(), motivo_revocada = 'salio'
     where token_hash = p_token_hash and revocada_en is null
    returning id
  )
  select jsonb_build_object('ok', true, 'cerradas', (select count(*) from cerrada));
$$;

create or replace function listar_usuarios(p_tenant_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(usuario_publico(u) order by u.activo desc, u.nombre), '[]'::jsonb)
    from usuarios u
   where u.tenant_id = p_tenant_id;
$$;

create or replace function crear_usuario(
  p_id                  uuid,
  p_tenant_id           uuid,
  p_cedula              text,
  p_nombre              text,
  p_rol                 text,
  p_clave_hash          text,
  p_debe_cambiar_clave  boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u usuarios;
begin
  select * into u from usuarios where id = p_id;
  if found then
    return jsonb_build_object('ok', true, 'yaExistia', true, 'usuario', usuario_publico(u));
  end if;

  select * into u from usuarios where tenant_id = p_tenant_id and cedula = p_cedula;
  if found then
    return jsonb_build_object('ok', false, 'error', 'cedula_duplicada', 'usuario', usuario_publico(u));
  end if;

  insert into usuarios (id, tenant_id, cedula, nombre, rol, clave_hash, debe_cambiar_clave)
  values (p_id, p_tenant_id, p_cedula, btrim(p_nombre), p_rol, p_clave_hash, p_debe_cambiar_clave)
  returning * into u;

  return jsonb_build_object('ok', true, 'yaExistia', false, 'usuario', usuario_publico(u));
end;
$$;

-- Cambios que hace el administrador. Lo que se deja en null no se toca.
create or replace function actualizar_usuario(
  p_tenant_id   uuid,
  p_id          uuid,
  p_actor_id    uuid,
  p_nombre      text default null,
  p_rol         text default null,
  p_activo      boolean default null,
  p_clave_hash  text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u usuarios;
  rol_anterior text;
  otros_admins int;
begin
  select * into u from usuarios where id = p_id and tenant_id = p_tenant_id for update;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'usuario_no_encontrado');
  end if;
  rol_anterior := u.rol;

  if p_actor_id = p_id and (p_activo = false or (p_rol is not null and p_rol <> u.rol)) then
    return jsonb_build_object('ok', false, 'error', 'no_sobre_si_mismo');
  end if;

  -- Sin administrador activo nadie podría volver a crear usuarios.
  if u.rol = 'administrador' and u.activo
     and (p_activo = false or (p_rol is not null and p_rol <> 'administrador')) then
    select count(*) into otros_admins from usuarios
     where tenant_id = p_tenant_id and rol = 'administrador' and activo and id <> p_id;
    if otros_admins = 0 then
      return jsonb_build_object('ok', false, 'error', 'ultimo_administrador');
    end if;
  end if;

  update usuarios set
    nombre             = coalesce(btrim(p_nombre), nombre),
    rol                = coalesce(p_rol, rol),
    activo             = coalesce(p_activo, activo),
    clave_hash         = coalesce(p_clave_hash, clave_hash),
    debe_cambiar_clave = case when p_clave_hash is not null then true else debe_cambiar_clave end,
    intentos_fallidos  = case when p_clave_hash is not null then 0 else intentos_fallidos end,
    bloqueado_hasta    = case when p_clave_hash is not null then null else bloqueado_hasta end,
    actualizado_en     = now()
  where id = p_id
  returning * into u;

  -- Desactivar, cambiar el rol o restablecer la contraseña saca a la persona
  -- de todos sus equipos: lo que tenía abierto ya no corresponde.
  if p_activo = false or p_clave_hash is not null or u.rol <> rol_anterior then
    update sesiones set revocada_en = now(), motivo_revocada = 'cambio_de_administrador'
     where usuario_id = p_id and revocada_en is null;
  end if;

  return jsonb_build_object('ok', true, 'usuario', usuario_publico(u));
end;
$$;

-- La persona cambia su propia contraseña. Se cierran sus otros equipos y se
-- mantiene el que está usando.
create or replace function cambiar_clave(
  p_usuario_id  uuid,
  p_clave_hash  text,
  p_sesion_id   uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  u usuarios;
begin
  update usuarios
     set clave_hash = p_clave_hash, debe_cambiar_clave = false, actualizado_en = now()
   where id = p_usuario_id
  returning * into u;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'usuario_no_encontrado');
  end if;

  update sesiones set revocada_en = now(), motivo_revocada = 'cambio_de_clave'
   where usuario_id = p_usuario_id and revocada_en is null
     and (p_sesion_id is null or id <> p_sesion_id);

  return jsonb_build_object('ok', true, 'usuario', usuario_publico(u));
end;
$$;

-- Solo la service_role. La anon key está en el navegador.
revoke all on function usuario_publico       from public, anon, authenticated;
revoke all on function hay_usuarios          from public, anon, authenticated;
revoke all on function usuario_para_ingresar from public, anon, authenticated;
revoke all on function registrar_ingreso     from public, anon, authenticated;
revoke all on function crear_sesion          from public, anon, authenticated;
revoke all on function rotar_sesion          from public, anon, authenticated;
revoke all on function cerrar_sesion         from public, anon, authenticated;
revoke all on function listar_usuarios       from public, anon, authenticated;
revoke all on function crear_usuario         from public, anon, authenticated;
revoke all on function actualizar_usuario    from public, anon, authenticated;
revoke all on function cambiar_clave         from public, anon, authenticated;

grant execute on function usuario_publico       to service_role;
grant execute on function hay_usuarios          to service_role;
grant execute on function usuario_para_ingresar to service_role;
grant execute on function registrar_ingreso     to service_role;
grant execute on function crear_sesion          to service_role;
grant execute on function rotar_sesion          to service_role;
grant execute on function cerrar_sesion         to service_role;
grant execute on function listar_usuarios       to service_role;
grant execute on function crear_usuario         to service_role;
grant execute on function actualizar_usuario    to service_role;
grant execute on function cambiar_clave         to service_role;

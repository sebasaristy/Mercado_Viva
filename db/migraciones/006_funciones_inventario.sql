-- La API entra por la REST de Supabase, no por una conexión directa a Postgres.
-- Esa REST no tiene transacciones de varias sentencias: cada llamada es su propia
-- transacción. Registrar un movimiento son dos escrituras que TIENEN que ir juntas
-- (el asiento en el libro y el delta en la proyección), así que la transacción se
-- mueve adentro de la base: el cuerpo de una función plpgsql ya es atómico.
--
-- Se llama con supabase.rpc('registrar_movimiento', {...}).

create or replace function registrar_movimiento(
  p_id           uuid,
  p_tenant_id    uuid,
  p_producto_id  uuid,
  p_tipo         tipo_movimiento,
  p_cantidad     numeric,          -- delta con signo, ya decidido por el dominio
  p_usuario_id   uuid,
  p_creado_en    timestamptz,
  p_ubicacion_id uuid    default null,
  p_motivo       text    default null,
  p_referencia   text    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ya_existia boolean;
  v_existencia numeric;
  v_movimiento jsonb;
begin
  -- El id lo generó la tablet al crear el movimiento. Si ya está, es un reintento
  -- porque no le llegó la respuesta: no se inserta de nuevo y no se aplica el delta.
  insert into movimientos (id, tenant_id, producto_id, ubicacion_id, tipo, cantidad,
                           motivo, referencia, usuario_id, creado_en)
  values (p_id, p_tenant_id, p_producto_id, p_ubicacion_id, p_tipo, p_cantidad,
          p_motivo, p_referencia, p_usuario_id, p_creado_en)
  on conflict (id) do nothing;

  v_ya_existia := not found;

  if not v_ya_existia then
    -- Nunca "cantidad = X": siempre suma. El upsert con la suma es atómico,
    -- así que dos movimientos simultáneos del mismo producto no se pisan.
    insert into existencias (tenant_id, producto_id, cantidad)
    values (p_tenant_id, p_producto_id, p_cantidad)
    on conflict (tenant_id, producto_id) do update
      set cantidad = existencias.cantidad + excluded.cantidad,
          actualizado_en = now();
  end if;

  select e.cantidad into v_existencia
    from existencias e
   where e.tenant_id = p_tenant_id and e.producto_id = p_producto_id;

  select to_jsonb(m) into v_movimiento
    from movimientos m
   where m.id = p_id;

  return jsonb_build_object(
    'yaExistia',  v_ya_existia,
    'existencia', coalesce(v_existencia, 0),
    'movimiento', v_movimiento
  );
end;
$$;

-- Solo la service role la puede llamar. La anon key es para el navegador,
-- y el navegador nunca escribe el inventario: pasa por nuestra API.
revoke all on function registrar_movimiento from public, anon, authenticated;
grant execute on function registrar_movimiento to service_role;

-- Los tres números en una sola llamada, para no armar el cálculo desde el cliente.
create or replace function disponible_de(
  p_tenant_id   uuid,
  p_producto_id uuid
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'teorico',    coalesce(d.teorico, 0),
    'reservado',  coalesce(d.reservado, 0),
    'colchon',    coalesce(d.colchon, 0),
    'disponible', coalesce(d.disponible, 0)
  )
  from (select 1) x
  left join v_disponible d
    on d.tenant_id = p_tenant_id and d.producto_id = p_producto_id;
$$;

revoke all on function disponible_de from public, anon, authenticated;
grant execute on function disponible_de to service_role;

-- Reservar es "mirar cuánto hay y apartar" en un solo paso. Partido en dos
-- llamadas REST, dos pedidos simultáneos pueden leer el mismo disponible y
-- apartar los dos la última unidad. Adentro de la función no: se bloquea la
-- fila de existencias antes de mirar, así que el segundo espera y ve el saldo real.
create or replace function reservar_lineas(
  p_tenant_id uuid,
  p_pedido_id uuid,
  p_lineas    jsonb,             -- [{ "productoId": "...", "cantidad": 3 }, ...]
  p_minutos   integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linea      jsonb;
  v_producto   uuid;
  v_cantidad   numeric;
  v_disponible numeric;
  v_faltantes  jsonb := '[]'::jsonb;
begin
  -- Primera pasada: bloquear y verificar. Si algo no alcanza, no se aparta nada.
  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_producto := (v_linea->>'productoId')::uuid;
    v_cantidad := (v_linea->>'cantidad')::numeric;

    perform 1 from existencias
      where tenant_id = p_tenant_id and producto_id = v_producto
      for update;

    select d.disponible into v_disponible
      from v_disponible d
     where d.tenant_id = p_tenant_id and d.producto_id = v_producto;

    v_disponible := coalesce(v_disponible, 0);

    if v_disponible < v_cantidad then
      v_faltantes := v_faltantes || jsonb_build_object(
        'productoId', v_producto,
        'pedida',     v_cantidad,
        'disponible', v_disponible
      );
    end if;
  end loop;

  if jsonb_array_length(v_faltantes) > 0 then
    return jsonb_build_object('ok', false, 'faltantes', v_faltantes);
  end if;

  -- Segunda pasada: apartar. Las filas siguen bloqueadas por esta transacción.
  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    insert into reservas (tenant_id, producto_id, pedido_id, cantidad, expira_en)
    values (
      p_tenant_id,
      (v_linea->>'productoId')::uuid,
      p_pedido_id,
      (v_linea->>'cantidad')::numeric,
      now() + (p_minutos || ' minutes')::interval
    );
  end loop;

  return jsonb_build_object('ok', true, 'reservadas', jsonb_array_length(p_lineas));
end;
$$;

revoke all on function reservar_lineas from public, anon, authenticated;
grant execute on function reservar_lineas to service_role;

-- Cuánto se movió un producto entre que se abrió la sesión de conteo y ahora.
-- El ajuste no es "contado menos teórico de hoy": es contado menos el teórico
-- congelado al abrir, más lo que se movió mientras se contaba.
create or replace function movido_durante_conteo(
  p_tenant_id   uuid,
  p_producto_id uuid,
  p_sesion_id   uuid
)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(m.cantidad), 0)
    from movimientos m
    join sesiones_conteo s on s.id = p_sesion_id
   where m.tenant_id = p_tenant_id
     and m.producto_id = p_producto_id
     and m.creado_en >= s.abierta_en
     and m.referencia is distinct from p_sesion_id::text;
$$;

revoke all on function movido_durante_conteo from public, anon, authenticated;
grant execute on function movido_durante_conteo to service_role;

-- Copia el precio y el costo actuales del producto a cada línea del pedido.
-- Es un update con join, que la REST no sabe expresar.
create or replace function congelar_precios_pedido(p_pedido_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_filas integer;
begin
  update pedido_lineas l
     set precio_unit = p.precio,
         costo_unit  = p.costo
    from productos p
   where p.id = l.producto_id
     and l.pedido_id = p_pedido_id;

  get diagnostics v_filas = row_count;
  return v_filas;
end;
$$;

revoke all on function congelar_precios_pedido from public, anon, authenticated;
grant execute on function congelar_precios_pedido to service_role;

-- Módulo dueño: catalogo
--
-- Catálogo progresivo desde la caja. Una tienda que arranca sin catálogo lo va
-- llenando con lo que vende: si el código no existe, la cajera lo registra con
-- nombre y precio y sigue cobrando. El producto queda "por revisar" hasta que
-- bodega le pone costo, categoría, mínimo y lo cuenta.
--
-- Se puede pegar más de una vez en Supabase.

alter table productos add column if not exists por_revisar boolean not null default false;

create index if not exists productos_por_revisar_idx
  on productos (tenant_id) where por_revisar;

-- Las dos lecturas del catálogo ahora dicen si el producto está por revisar.
create or replace function producto_con_stock(
  p_tenant_id uuid,
  p_id        uuid default null,
  p_codigo    text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',           p.id,
    'codigoBarras', p.codigo_barras,
    'nombre',       p.nombre,
    'categoria',    p.categoria,
    'unidad',       p.unidad,
    'precio',       p.precio,
    'costo',        coalesce(p.costo, 0),
    'stockMinimo',  p.stock_minimo,
    'existencia',   coalesce(e.cantidad, 0),
    'porRevisar',   p.por_revisar,
    'estado', case
      when coalesce(e.cantidad, 0) <= 0             then 'agotado'
      when coalesce(e.cantidad, 0) <= p.stock_minimo then 'bajo'
      else 'ok'
    end
  )
  from productos p
  left join existencias e
    on e.tenant_id = p.tenant_id and e.producto_id = p.id
  where p.tenant_id = p_tenant_id
    and p.activo
    and (   (p_id is not null     and p.id = p_id)
         or (p_codigo is not null and p.codigo_barras = p_codigo))
  limit 1;
$$;

create or replace function listar_productos(
  p_tenant_id uuid,
  p_busqueda  text default null
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with vendidas as (
    select l.producto_id, sum(l.cantidad) as unidades
      from venta_lineas l
      join ventas v on v.id = l.venta_id
     where v.tenant_id = p_tenant_id
       and v.creado_en >= now() - interval '7 days'
     group by l.producto_id
  )
  select coalesce(jsonb_agg(fila order by fila->>'nombre'), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id',           p.id,
      'codigoBarras', p.codigo_barras,
      'nombre',       p.nombre,
      'categoria',    p.categoria,
      'unidad',       p.unidad,
      'precio',       p.precio,
      'costo',        coalesce(p.costo, 0),
      'stockMinimo',  p.stock_minimo,
      'existencia',   coalesce(e.cantidad, 0),
      'vendidas7d',   coalesce(vd.unidades, 0),
      'porRevisar',   p.por_revisar,
      'estado', case
        when coalesce(e.cantidad, 0) <= 0             then 'agotado'
        when coalesce(e.cantidad, 0) <= p.stock_minimo then 'bajo'
        else 'ok'
      end
    ) as fila
    from productos p
    left join existencias e on e.tenant_id = p.tenant_id and e.producto_id = p.id
    left join vendidas vd   on vd.producto_id = p.id
    where p.tenant_id = p_tenant_id
      and p.activo
      and (   coalesce(p_busqueda, '') = ''
           or p.nombre ilike '%' || p_busqueda || '%'
           or p.codigo_barras = p_busqueda)
  ) t;
$$;

-- Registro rápido: nombre, precio y cómo se vende. Sin costo, sin categoría y
-- sin stock contado; por eso queda marcado para revisar. Reutiliza
-- crear_producto, así que un código repetido o un reintento se comportan igual.
create or replace function crear_producto_rapido(
  p_id          uuid,
  p_tenant_id   uuid,
  p_usuario_id  uuid,
  p_nombre      text,
  p_precio      numeric,
  p_unidad      text default 'unidad',
  p_codigo      text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r jsonb;
begin
  r := crear_producto(
    p_id => p_id, p_tenant_id => p_tenant_id, p_usuario_id => p_usuario_id,
    p_nombre => p_nombre, p_categoria => 'Sin categoría', p_unidad => p_unidad,
    p_precio => p_precio, p_costo => 0, p_stock_minimo => 0,
    p_codigo => p_codigo, p_cantidad_inicial => 0
  );

  if coalesce((r->>'ok')::boolean, false) then
    if not coalesce((r->>'yaExistia')::boolean, false) then
      update productos set por_revisar = true where id = p_id;
    end if;
    r := jsonb_set(r, '{producto}',
      producto_con_stock(p_tenant_id, p_id => (r->'producto'->>'id')::uuid));
  end if;

  return r;
end;
$$;

-- Bodega completa el producto. Lo que llega en null no se toca.
create or replace function completar_producto(
  p_tenant_id     uuid,
  p_id            uuid,
  p_nombre        text default null,
  p_categoria     text default null,
  p_precio        numeric default null,
  p_costo         numeric default null,
  p_stock_minimo  numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_precio is not null and p_precio <= 0 then
    return jsonb_build_object('ok', false, 'error', 'precio_invalido');
  end if;

  update productos set
    nombre       = coalesce(nullif(btrim(p_nombre), ''), nombre),
    categoria    = coalesce(nullif(btrim(p_categoria), ''), categoria),
    precio       = coalesce(p_precio, precio),
    costo        = coalesce(p_costo, costo),
    stock_minimo = coalesce(p_stock_minimo, stock_minimo),
    por_revisar  = false
  where id = p_id and tenant_id = p_tenant_id and activo;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'no_encontrado');
  end if;

  return jsonb_build_object('ok', true, 'producto', producto_con_stock(p_tenant_id, p_id => p_id));
end;
$$;

revoke all on function producto_con_stock    from public, anon, authenticated;
revoke all on function listar_productos      from public, anon, authenticated;
revoke all on function crear_producto_rapido from public, anon, authenticated;
revoke all on function completar_producto    from public, anon, authenticated;

grant execute on function producto_con_stock    to service_role;
grant execute on function listar_productos      to service_role;
grant execute on function crear_producto_rapido to service_role;
grant execute on function completar_producto    to service_role;

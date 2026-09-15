-- 007 · Ventas en caja, catálogo con stock y tablero del negocio
--
-- Dueño de ventas y venta_lineas: el módulo ventas.
--
-- Excepción deliberada a "cada tabla tiene un solo módulo dueño":
-- registrar_venta escribe en ventas, movimientos y existencias dentro de una
-- misma transacción. Una venta de cinco productos no puede quedar a medias
-- —cobrar tres y descontar dos del inventario es peor que no vender— y la REST
-- de Supabase no tiene transacciones entre llamadas. resumen_tablero también
-- cruza módulos, pero solo lee: es un modelo de lectura. Ver decisión 009.

alter table productos add column if not exists stock_minimo numeric not null default 0;

create table if not exists ventas (
  id           uuid primary key,          -- lo genera la caja: reintentar no duplica
  tenant_id    uuid not null,
  usuario_id   uuid not null,
  metodo_pago  text not null check (metodo_pago in ('efectivo', 'tarjeta', 'transferencia')),
  total        numeric(14,2) not null,
  costo_total  numeric(14,2) not null,
  recibido     numeric(14,2),
  unidades     numeric not null,
  creado_en    timestamptz not null default now()
);
create index if not exists ventas_tenant_fecha_idx on ventas (tenant_id, creado_en desc);

create table if not exists venta_lineas (
  id           bigserial primary key,
  venta_id     uuid not null references ventas(id) on delete cascade,
  producto_id  uuid not null references productos(id),
  cantidad     numeric not null check (cantidad > 0),
  precio_unit  numeric(12,2) not null,    -- foto del precio al vender
  costo_unit   numeric(12,2) not null default 0,
  subtotal     numeric(14,2) not null
);
create index if not exists venta_lineas_producto_idx on venta_lineas (producto_id);
create index if not exists venta_lineas_venta_idx on venta_lineas (venta_id);

-- ---------------------------------------------------------------------------
-- Seguridad. La anon key viaja dentro de la PWA, así que cualquiera puede
-- leerla. Sin RLS, esa clave podía leer y escribir todas las tablas por la
-- REST. Con RLS encendido y sin políticas, anon y authenticated no ven nada;
-- la service_role (solo en el servidor) y las funciones de abajo sí.
-- ---------------------------------------------------------------------------
alter table productos        enable row level security;
alter table equivalencias    enable row level security;
alter table ubicaciones      enable row level security;
alter table movimientos      enable row level security;
alter table existencias      enable row level security;
alter table colchones        enable row level security;
alter table reservas         enable row level security;
alter table sesiones_conteo  enable row level security;
alter table zonas_conteo     enable row level security;
alter table conteo_lineas    enable row level security;
alter table pedidos          enable row level security;
alter table pedido_lineas    enable row level security;
alter table pedido_eventos   enable row level security;
alter table ventas           enable row level security;
alter table venta_lineas     enable row level security;

-- Una vista corre con los permisos de su dueño y se saltaría el RLS.
revoke all on v_disponible from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Catálogo con stock
-- ---------------------------------------------------------------------------

-- Un producto con su existencia y su estado, buscado por id o por código.
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

-- Crea el producto y, si trae cantidad inicial, la ingresa en la misma transacción.
-- Es el "catálogo progresivo": un código desconocido no es un callejón sin salida.
create or replace function crear_producto(
  p_id               uuid,
  p_tenant_id        uuid,
  p_usuario_id       uuid,
  p_nombre           text,
  p_categoria        text,
  p_unidad           text,
  p_precio           numeric,
  p_costo            numeric default 0,
  p_stock_minimo     numeric default 0,
  p_codigo           text    default null,
  p_cantidad_inicial numeric default 0,
  p_movimiento_id    uuid    default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_otro uuid;
  v_codigo text := nullif(trim(coalesce(p_codigo, '')), '');
  v_inicial numeric := coalesce(p_cantidad_inicial, 0);
begin
  -- Reintento: la tablet no alcanzó a recibir la respuesta y manda lo mismo.
  if exists (select 1 from productos where id = p_id) then
    return jsonb_build_object('ok', true, 'yaExistia', true,
      'producto', producto_con_stock(p_tenant_id, p_id, null));
  end if;

  if trim(coalesce(p_nombre, '')) = '' then
    return jsonb_build_object('ok', false, 'error', 'nombre_requerido');
  end if;
  if p_unidad not in ('unidad', 'kg') then
    return jsonb_build_object('ok', false, 'error', 'unidad_invalida');
  end if;
  if p_precio is null or p_precio <= 0 then
    return jsonb_build_object('ok', false, 'error', 'precio_invalido');
  end if;
  if v_inicial < 0 or (p_unidad = 'unidad' and v_inicial <> trunc(v_inicial)) then
    return jsonb_build_object('ok', false, 'error', 'cantidad_invalida');
  end if;

  if v_codigo is not null then
    select id into v_otro from productos
     where tenant_id = p_tenant_id and codigo_barras = v_codigo
     limit 1;
    if v_otro is not null then
      return jsonb_build_object('ok', false, 'error', 'codigo_duplicado',
        'producto', producto_con_stock(p_tenant_id, v_otro, null));
    end if;
  end if;

  insert into productos (id, tenant_id, codigo_barras, nombre, categoria, unidad,
                         precio, costo, stock_minimo)
  values (p_id, p_tenant_id, v_codigo, trim(p_nombre), coalesce(p_categoria, 'General'),
          p_unidad, p_precio, coalesce(p_costo, 0), coalesce(p_stock_minimo, 0));

  if v_inicial > 0 then
    insert into movimientos (id, tenant_id, producto_id, tipo, cantidad, motivo,
                             usuario_id, creado_en)
    values (coalesce(p_movimiento_id, gen_random_uuid()), p_tenant_id, p_id, 'ENTRADA',
            v_inicial, 'stock inicial', p_usuario_id, now());

    insert into existencias (tenant_id, producto_id, cantidad)
    values (p_tenant_id, p_id, v_inicial)
    on conflict (tenant_id, producto_id) do update
      set cantidad = existencias.cantidad + excluded.cantidad,
          actualizado_en = now();
  end if;

  return jsonb_build_object('ok', true, 'yaExistia', false,
    'producto', producto_con_stock(p_tenant_id, p_id, null));
end;
$$;

-- ---------------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------------

create or replace function venta_detalle(p_venta_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id',         v.id,
    'total',      v.total,
    'costoTotal', v.costo_total,
    'ganancia',   v.total - v.costo_total,
    'unidades',   v.unidades,
    'metodoPago', v.metodo_pago,
    'recibido',   v.recibido,
    'cambio',     case when v.recibido is not null then v.recibido - v.total end,
    'creadoEn',   v.creado_en,
    'lineas', coalesce((
      select jsonb_agg(jsonb_build_object(
               'productoId', l.producto_id,
               'nombre',     p.nombre,
               'unidad',     p.unidad,
               'cantidad',   l.cantidad,
               'precioUnit', l.precio_unit,
               'subtotal',   l.subtotal) order by l.id)
        from venta_lineas l
        join productos p on p.id = l.producto_id
       where l.venta_id = v.id), '[]'::jsonb)
  )
  from ventas v
  where v.id = p_venta_id;
$$;

-- Registra una venta completa o nada.
--
-- El precio lo pone la base, nunca la caja: quien llama solo manda producto y
-- cantidad. Así no se puede vender más barato de lo que dice el catálogo.
--
-- La venta NUNCA se bloquea por stock. Si el sistema dice que no hay pero el
-- cliente tiene el producto en la mano, el sistema está mal, no la venta: se
-- vende y se devuelve una alerta para revisar ese producto.
create or replace function registrar_venta(
  p_id          uuid,
  p_tenant_id   uuid,
  p_usuario_id  uuid,
  p_metodo_pago text,
  p_lineas      jsonb,             -- [{ "productoId": "...", "cantidad": 2 }, ...]
  p_recibido    numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linea      jsonb;
  v_prod       record;
  v_cantidad   numeric;
  v_subtotal   numeric;
  v_total      numeric := 0;
  v_costo      numeric := 0;
  v_unidades   numeric := 0;
  v_existencia numeric;
  v_alertas    jsonb := '[]'::jsonb;
begin
  if exists (select 1 from ventas where id = p_id) then
    return jsonb_build_object('ok', true, 'yaExistia', true,
      'venta', venta_detalle(p_id), 'alertas', '[]'::jsonb);
  end if;

  if p_metodo_pago not in ('efectivo', 'tarjeta', 'transferencia') then
    return jsonb_build_object('ok', false, 'error', 'metodo_pago_invalido');
  end if;

  if p_lineas is null or jsonb_typeof(p_lineas) <> 'array' or jsonb_array_length(p_lineas) = 0 then
    return jsonb_build_object('ok', false, 'error', 'venta_vacia');
  end if;

  -- Primera pasada: validar todo antes de escribir nada.
  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cantidad := (v_linea->>'cantidad')::numeric;

    select id, nombre, unidad, precio into v_prod
      from productos
     where id = (v_linea->>'productoId')::uuid
       and tenant_id = p_tenant_id
       and activo;

    if not found then
      return jsonb_build_object('ok', false, 'error', 'producto_no_existe',
        'productoId', v_linea->>'productoId');
    end if;
    if v_cantidad is null or v_cantidad <= 0 then
      return jsonb_build_object('ok', false, 'error', 'cantidad_invalida', 'nombre', v_prod.nombre);
    end if;
    if v_prod.unidad = 'unidad' and v_cantidad <> trunc(v_cantidad) then
      return jsonb_build_object('ok', false, 'error', 'decimales_en_unidad', 'nombre', v_prod.nombre);
    end if;

    v_total := v_total + round(v_prod.precio * v_cantidad);
  end loop;

  if p_metodo_pago = 'efectivo' and p_recibido is not null and p_recibido < v_total then
    return jsonb_build_object('ok', false, 'error', 'recibido_insuficiente', 'total', v_total);
  end if;

  -- Segunda pasada: escribir. Todo dentro de la misma transacción.
  v_total := 0;
  insert into ventas (id, tenant_id, usuario_id, metodo_pago, total, costo_total, recibido, unidades)
  values (p_id, p_tenant_id, p_usuario_id, p_metodo_pago, 0, 0, p_recibido, 0);

  for v_linea in select * from jsonb_array_elements(p_lineas) loop
    v_cantidad := (v_linea->>'cantidad')::numeric;

    select id, nombre, unidad, precio, coalesce(costo, 0) as costo, stock_minimo into v_prod
      from productos
     where id = (v_linea->>'productoId')::uuid;

    v_subtotal := round(v_prod.precio * v_cantidad);

    insert into venta_lineas (venta_id, producto_id, cantidad, precio_unit, costo_unit, subtotal)
    values (p_id, v_prod.id, v_cantidad, v_prod.precio, v_prod.costo, v_subtotal);

    insert into movimientos (id, tenant_id, producto_id, tipo, cantidad, referencia,
                             usuario_id, creado_en)
    values (gen_random_uuid(), p_tenant_id, v_prod.id, 'SALIDA', -v_cantidad,
            'venta:' || p_id, p_usuario_id, now());

    insert into existencias (tenant_id, producto_id, cantidad)
    values (p_tenant_id, v_prod.id, -v_cantidad)
    on conflict (tenant_id, producto_id) do update
      set cantidad = existencias.cantidad + excluded.cantidad,
          actualizado_en = now()
    returning cantidad into v_existencia;

    v_total    := v_total + v_subtotal;
    v_costo    := v_costo + round(v_prod.costo * v_cantidad, 2);
    v_unidades := v_unidades + v_cantidad;

    if v_existencia <= v_prod.stock_minimo then
      v_alertas := v_alertas || jsonb_build_object(
        'productoId',  v_prod.id,
        'nombre',      v_prod.nombre,
        'existencia',  v_existencia,
        'stockMinimo', v_prod.stock_minimo,
        'tipo', case when v_existencia < 0 then 'negativo'
                     when v_existencia = 0 then 'agotado'
                     else 'bajo' end);
    end if;
  end loop;

  update ventas
     set total = v_total, costo_total = v_costo, unidades = v_unidades
   where id = p_id;

  return jsonb_build_object('ok', true, 'yaExistia', false,
    'venta', venta_detalle(p_id), 'alertas', v_alertas);
end;
$$;

-- ---------------------------------------------------------------------------
-- Tablero
--
-- "Hoy" es el día de la tienda, no el de UTC: en Bogotá las 8 p. m. ya son
-- mañana en UTC, y sin la zona el tablero partiría el día a las 7 de la noche.
-- ---------------------------------------------------------------------------
create or replace function resumen_tablero(
  p_tenant_id uuid,
  p_zona      text default 'America/Bogota'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_hoy_local  date        := (now() at time zone p_zona)::date;
  v_ini_hoy    timestamptz := (v_hoy_local::timestamp) at time zone p_zona;
  v_ini_ayer   timestamptz := ((v_hoy_local - 1)::timestamp) at time zone p_zona;
  v_hoy        jsonb;
  v_ayer       jsonb;
  v_por_hora   jsonb;
  v_dias       jsonb;
  v_top        jsonb;
  v_reabast    jsonb;
  v_quietos    jsonb;
  v_inventario jsonb;
  v_merma      jsonb;
  v_ultimas    jsonb;
  v_metodos    jsonb;
begin
  select jsonb_build_object(
    'ventas',         coalesce(sum(total), 0),
    'transacciones',  count(*),
    -- Kilos y unidades no se suman entre sí: "107,5 vendidos" no significa nada.
    'unidades', coalesce((
      select sum(l.cantidad)
        from venta_lineas l
        join ventas v2   on v2.id = l.venta_id
        join productos p on p.id = l.producto_id
       where v2.tenant_id = p_tenant_id and v2.creado_en >= v_ini_hoy and p.unidad = 'unidad'), 0),
    'kilos', coalesce((
      select sum(l.cantidad)
        from venta_lineas l
        join ventas v2   on v2.id = l.venta_id
        join productos p on p.id = l.producto_id
       where v2.tenant_id = p_tenant_id and v2.creado_en >= v_ini_hoy and p.unidad = 'kg'), 0),
    'costo',          coalesce(sum(costo_total), 0),
    'ganancia',       coalesce(sum(total - costo_total), 0),
    'ticketPromedio', case when count(*) > 0 then round(sum(total) / count(*)) else 0 end,
    'margenPct',      case when coalesce(sum(total), 0) > 0
                           then round(100 * sum(total - costo_total) / sum(total), 1) end)
    into v_hoy
    from ventas
   where tenant_id = p_tenant_id and creado_en >= v_ini_hoy;

  -- Comparar el día de hoy a medias contra todo el día de ayer engaña siempre a
  -- la baja. Se compara contra ayer hasta esta misma hora.
  select jsonb_build_object(
    'ventas',             coalesce(sum(total), 0),
    'transacciones',      count(*),
    'ventasALaMismaHora', coalesce(sum(total) filter (where creado_en <= now() - interval '1 day'), 0))
    into v_ayer
    from ventas
   where tenant_id = p_tenant_id and creado_en >= v_ini_ayer and creado_en < v_ini_hoy;

  select jsonb_agg(jsonb_build_object('hora', h, 'ventas', coalesce(x.total, 0)) order by h)
    into v_por_hora
    from generate_series(0, 23) h
    left join (
      select extract(hour from creado_en at time zone p_zona)::int as hora, sum(total) as total
        from ventas
       where tenant_id = p_tenant_id and creado_en >= v_ini_hoy
       group by 1
    ) x on x.hora = h;

  select jsonb_agg(jsonb_build_object('fecha', d::date, 'ventas', coalesce(x.total, 0)) order by d)
    into v_dias
    from generate_series(v_hoy_local - 6, v_hoy_local, interval '1 day') d
    left join (
      select (creado_en at time zone p_zona)::date as f, sum(total) as total
        from ventas
       where tenant_id = p_tenant_id and creado_en >= v_ini_hoy - interval '6 days'
       group by 1
    ) x on x.f = d::date;

  select coalesce(jsonb_agg(jsonb_build_object(
           'productoId', id, 'nombre', nombre, 'unidad', unidad,
           'unidades', unidades, 'ingreso', ingreso, 'ganancia', ganancia) order by ingreso desc), '[]'::jsonb)
    into v_top
    from (
      select p.id, p.nombre, p.unidad,
             sum(l.cantidad) as unidades,
             sum(l.subtotal) as ingreso,
             round(sum(l.subtotal - l.costo_unit * l.cantidad)) as ganancia
        from venta_lineas l
        join ventas v    on v.id = l.venta_id
        join productos p on p.id = l.producto_id
       where v.tenant_id = p_tenant_id
         and v.creado_en >= now() - interval '7 days'
       group by p.id, p.nombre, p.unidad
       order by sum(l.subtotal) desc
       limit 5
    ) t;

  -- Lo que hay que pedir. Es la plata que más se pierde en una tienda: el
  -- cliente que no encuentra lo que busca no espera, se va a la de enfrente.
  with base as (
    select p.id, p.nombre, p.unidad, p.stock_minimo,
           coalesce(e.cantidad, 0)           as existencia,
           coalesce(vd.unidades, 0) / 14.0   as venta_diaria
      from productos p
      left join existencias e on e.tenant_id = p.tenant_id and e.producto_id = p.id
      left join (
        select l.producto_id, sum(l.cantidad) as unidades
          from venta_lineas l
          join ventas v on v.id = l.venta_id
         where v.tenant_id = p_tenant_id and v.creado_en >= now() - interval '14 days'
         group by l.producto_id
      ) vd on vd.producto_id = p.id
     where p.tenant_id = p_tenant_id and p.activo
  ), calc as (
    select *,
           case when venta_diaria > 0 then round(greatest(existencia, 0) / venta_diaria, 1) end as dias,
           case when existencia <= 0 then 1 when existencia <= stock_minimo then 2 else 3 end as prioridad,
           greatest(ceil(venta_diaria * 7 + stock_minimo - existencia), 0) as sugerido
      from base
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'productoId',    id,
           'nombre',        nombre,
           'unidad',        unidad,
           'existencia',    existencia,
           'stockMinimo',   stock_minimo,
           'ventaDiaria',   round(venta_diaria, 2),
           'diasCobertura', dias,
           'sugeridoPedir', sugerido,
           'estado',        case prioridad when 1 then 'agotado' when 2 then 'bajo' else 'por_agotarse' end
         ) order by prioridad, dias nulls last), '[]'::jsonb)
    into v_reabast
    from (
      select * from calc
       where existencia <= stock_minimo or (dias is not null and dias < 3)
       order by prioridad, dias nulls last
       limit 12
    ) x;

  -- Plata quieta: productos con stock que no se venden. Es capital de trabajo
  -- congelado en la estantería. Los recién creados no cuentan todavía.
  select coalesce(jsonb_agg(jsonb_build_object(
           'productoId', id, 'nombre', nombre, 'existencia', existencia, 'valorCosto', valor)
           order by valor desc), '[]'::jsonb)
    into v_quietos
    from (
      select p.id, p.nombre, e.cantidad as existencia,
             round(e.cantidad * coalesce(p.costo, 0)) as valor
        from productos p
        join existencias e on e.tenant_id = p.tenant_id and e.producto_id = p.id
       where p.tenant_id = p_tenant_id and p.activo
         and e.cantidad > 0
         and p.creado_en < now() - interval '14 days'
         and not exists (
           select 1 from venta_lineas l
             join ventas v on v.id = l.venta_id
            where l.producto_id = p.id and v.creado_en >= now() - interval '14 days')
       order by valor desc
       limit 5
    ) q;

  select jsonb_build_object(
    'productos',  count(*),
    'agotados',   count(*) filter (where coalesce(e.cantidad, 0) <= 0),
    'bajos',      count(*) filter (where coalesce(e.cantidad, 0) > 0
                                     and coalesce(e.cantidad, 0) <= p.stock_minimo),
    'valorCosto', round(coalesce(sum(greatest(coalesce(e.cantidad, 0), 0) * coalesce(p.costo, 0)), 0)),
    'valorVenta', round(coalesce(sum(greatest(coalesce(e.cantidad, 0), 0) * p.precio), 0)))
    into v_inventario
    from productos p
    left join existencias e on e.tenant_id = p.tenant_id and e.producto_id = p.id
   where p.tenant_id = p_tenant_id and p.activo;

  select jsonb_build_object(
    'registros',  count(*),
    'unidades',   coalesce(sum(-m.cantidad), 0),
    'valorCosto', round(coalesce(sum(-m.cantidad * coalesce(p.costo, 0)), 0)))
    into v_merma
    from movimientos m
    join productos p on p.id = m.producto_id
   where m.tenant_id = p_tenant_id
     and m.tipo = 'MERMA'
     and m.creado_en >= now() - interval '7 days';

  -- "productos" es cuántas referencias distintas llevó: se puede leer en una
  -- venta que mezcla kilos y unidades, cosa que "unidades" no permite.
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'total', total,
           'productos', (select count(*) from venta_lineas l where l.venta_id = u.id),
           'metodoPago', metodo_pago, 'creadoEn', creado_en) order by creado_en desc), '[]'::jsonb)
    into v_ultimas
    from (select * from ventas where tenant_id = p_tenant_id order by creado_en desc limit 8) u;

  select coalesce(jsonb_agg(jsonb_build_object(
           'metodo', metodo_pago, 'ventas', total, 'transacciones', n) order by total desc), '[]'::jsonb)
    into v_metodos
    from (
      select metodo_pago, sum(total) as total, count(*) as n
        from ventas
       where tenant_id = p_tenant_id and creado_en >= v_ini_hoy
       group by metodo_pago
    ) m;

  return jsonb_build_object(
    'zona',          p_zona,
    'generadoEn',    now(),
    'hoy',           v_hoy,
    'ayer',          v_ayer,
    'porHora',       v_por_hora,
    'ultimos7Dias',  v_dias,
    'top',           v_top,
    'reabastecer',   v_reabast,
    'quietos',       v_quietos,
    'inventario',    v_inventario,
    'merma7d',       v_merma,
    'ultimasVentas', v_ultimas,
    'metodosPago',   v_metodos
  );
end;
$$;

-- Solo la service_role. La anon key está en el navegador.
revoke all on function producto_con_stock from public, anon, authenticated;
revoke all on function listar_productos   from public, anon, authenticated;
revoke all on function crear_producto     from public, anon, authenticated;
revoke all on function venta_detalle      from public, anon, authenticated;
revoke all on function registrar_venta    from public, anon, authenticated;
revoke all on function resumen_tablero    from public, anon, authenticated;

grant execute on function producto_con_stock to service_role;
grant execute on function listar_productos   to service_role;
grant execute on function crear_producto     to service_role;
grant execute on function venta_detalle      to service_role;
grant execute on function registrar_venta    to service_role;
grant execute on function resumen_tablero    to service_role;

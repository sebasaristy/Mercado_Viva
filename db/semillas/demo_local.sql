-- Datos de demostración para el modo local (DATOS=local).
-- NO correr en Supabase: inventa 14 días de ventas.
--
-- Se generan con semilla fija para que el tablero se vea igual en todas las
-- máquinas del equipo. Queda armado a propósito para que el tablero tenga algo
-- que decir: productos por agotarse, uno agotado, uno quieto y algo de merma.
do $$
declare
  t        uuid := '00000000-0000-0000-0000-000000000001';
  u        uuid := '00000000-0000-0000-0000-0000000000de';
  zona     text := 'America/Bogota';
  hoy      date := (now() at time zone 'America/Bogota')::date;
  d        int;
  n        int;
  i        int;
  v        uuid;
  p        record;
  q        numeric;
  tot      numeric;
  cst      numeric;
  unid     numeric;
  momento  timestamptz;
begin
  if exists (select 1 from productos where tenant_id = t) then
    return;
  end if;

  perform setseed(0.42);

  insert into productos (id, tenant_id, codigo_barras, nombre, categoria, unidad,
                         precio, costo, stock_minimo, creado_en)
  values
    ('10000000-0000-4000-8000-000000000001', t, '7702001010011', 'Arroz Diana 500 g',        'Abarrotes', 'unidad',  3200,  2450, 12, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000002', t, '7702001010028', 'Arroz Roa 500 g',          'Abarrotes', 'unidad',  3350,  2600, 10, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000003', t, '7701234500019', 'Aceite Girasol 1 L',       'Abarrotes', 'unidad', 12900, 10100,  6, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000004', t, '7702406000013', 'Azúcar Manuelita 1 kg',    'Abarrotes', 'unidad',  4800,  3700, 10, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000005', t, '7702032100017', 'Café Sello Rojo 250 g',    'Abarrotes', 'unidad',  9800,  7600,  8, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000006', t, '7702354001015', 'Leche Alquería 1 L',       'Lácteos',   'unidad',  4100,  3300, 20, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000007', t, '7702354002012', 'Leche Colanta 1 L',        'Lácteos',   'unidad',  4100,  3250, 20, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000008', t, '7709876500013', 'Huevos AA x 30',           'Huevos',    'unidad', 18500, 15200,  6, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000009', t, '7705566700012', 'Pan tajado 500 g',         'Panadería', 'unidad',  6900,  5100,  8, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000010', t, '7704433200015', 'Queso campesino 500 g',    'Lácteos',   'unidad', 11500,  8800,  5, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000011', t, '12345',         'Banano',                   'Frutas',    'kg',      3800,  2400, 10, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000012', t, '12346',         'Tomate chonto',            'Verduras',  'kg',      4500,  2900,  8, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000013', t, '12347',         'Papa pastusa',             'Verduras',  'kg',      2900,  1800, 15, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000014', t, '7702535011119', 'Gaseosa Cola 1.5 L',       'Bebidas',   'unidad',  6500,  4900, 12, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000015', t, '7702535022214', 'Agua 600 ml',              'Bebidas',   'unidad',  2200,  1300, 24, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000016', t, '7702191000016', 'Jabón de barra x3',        'Aseo',      'unidad',  7200,  5400,  6, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000017', t, '7702047001116', 'Salsa de tomate 400 g',    'Abarrotes', 'unidad',  7800,  5900,  4, now() - interval '60 days'),
    ('10000000-0000-4000-8000-000000000018', t, '7702910003318', 'Atún en lata 175 g',       'Abarrotes', 'unidad',  8900,  6700, 10, now() - interval '60 days');

  -- Stock inicial hace 15 días y una compra hace 7.
  insert into movimientos (id, tenant_id, producto_id, tipo, cantidad, motivo, usuario_id, creado_en)
  select gen_random_uuid(), t, id, 'ENTRADA',
         case when unidad = 'kg' then 70 else 55 end,
         'stock inicial', u, now() - interval '15 days'
    from productos where tenant_id = t;

  insert into movimientos (id, tenant_id, producto_id, tipo, cantidad, motivo, usuario_id, creado_en)
  select gen_random_uuid(), t, id, 'ENTRADA',
         case when unidad = 'kg' then 40 else 30 end,
         'compra a proveedor', u, now() - interval '7 days'
    from productos where tenant_id = t;

  -- 14 días de ventas. La salsa de tomate no se vende nunca: es la plata quieta.
  for d in reverse 13..0 loop
    n := 16 + floor(random() * 12)::int;
    for i in 1..n loop
      momento := ((hoy - d)::timestamp
                   + make_interval(hours => 7 + floor(random() * 14)::int,
                                   mins  => floor(random() * 60)::int)) at time zone zona;
      continue when momento > now();

      v := gen_random_uuid();
      insert into ventas (id, tenant_id, usuario_id, metodo_pago, total, costo_total, unidades, creado_en)
      values (v, t, u,
              (array['efectivo', 'efectivo', 'tarjeta', 'transferencia'])[1 + floor(random() * 4)::int],
              0, 0, 0, momento);

      tot := 0; cst := 0; unid := 0;

      for p in
        select * from productos
         where tenant_id = t and nombre not like 'Salsa%'
         order by random()
         limit 1 + floor(random() * 4)::int
      loop
        q := case when p.unidad = 'kg'
                  then round((0.5 + random() * 2)::numeric, 1)
                  else 1 + floor(random() * 3) end;

        insert into venta_lineas (venta_id, producto_id, cantidad, precio_unit, costo_unit, subtotal)
        values (v, p.id, q, p.precio, p.costo, round(p.precio * q));

        insert into movimientos (id, tenant_id, producto_id, tipo, cantidad, referencia, usuario_id, creado_en)
        values (gen_random_uuid(), t, p.id, 'SALIDA', -q, 'venta:' || v, u, momento);

        tot  := tot + round(p.precio * q);
        cst  := cst + round(p.costo * q, 2);
        unid := unid + q;
      end loop;

      update ventas set total = tot, costo_total = cst, unidades = unid where id = v;
    end loop;
  end loop;

  -- Algo de merma, que en una tienda de alimentos siempre hay.
  insert into movimientos (id, tenant_id, producto_id, tipo, cantidad, motivo, usuario_id, creado_en) values
    (gen_random_uuid(), t, '10000000-0000-4000-8000-000000000006', 'MERMA', -4,   'Vencido', u, now() - interval '2 days'),
    (gen_random_uuid(), t, '10000000-0000-4000-8000-000000000012', 'MERMA', -3.5, 'Dañado',  u, now() - interval '1 day'),
    (gen_random_uuid(), t, '10000000-0000-4000-8000-000000000009', 'MERMA', -3,   'Vencido', u, now() - interval '3 days');

  -- La existencia sale de sumar el libro.
  insert into existencias (tenant_id, producto_id, cantidad)
  select t, producto_id, sum(cantidad) from movimientos where tenant_id = t group by producto_id
  on conflict (tenant_id, producto_id) do update set cantidad = excluded.cantidad;

  -- Con este volumen de ventas lo que más rota se habría agotado a mitad de
  -- semana. Una tienda real habría comprado: se registra esa compra hace 4 días.
  insert into movimientos (id, tenant_id, producto_id, tipo, cantidad, motivo, usuario_id, creado_en)
  -- Ojo: el alias es "pr" y no "p", porque dentro de este bloque "p" ya es la
  -- variable del ciclo de ventas y plpgsql confunde los dos.
  select gen_random_uuid(), t, e.producto_id, 'ENTRADA',
         ceil(pr.stock_minimo * 3 - e.cantidad), 'compra a proveedor', u, now() - interval '4 days'
    from existencias e
    join productos pr on pr.id = e.producto_id
   where e.tenant_id = t
     and e.cantidad < pr.stock_minimo * 2;

  insert into existencias (tenant_id, producto_id, cantidad)
  select t, producto_id, sum(cantidad) from movimientos where tenant_id = t group by producto_id
  on conflict (tenant_id, producto_id) do update set cantidad = excluded.cantidad;

  -- Para que el tablero tenga algo urgente: huevos casi agotados y queso agotado.
  insert into movimientos (id, tenant_id, producto_id, tipo, cantidad, motivo, usuario_id, creado_en)
  select gen_random_uuid(), t, producto_id, 'AJUSTE', objetivo - cantidad, 'conteo: faltante', u, now() - interval '3 hours'
    from (
      select e.producto_id, e.cantidad,
             case e.producto_id
               when '10000000-0000-4000-8000-000000000008' then 2
               when '10000000-0000-4000-8000-000000000010' then 0
             end as objetivo
        from existencias e
       where e.tenant_id = t
         and e.producto_id in ('10000000-0000-4000-8000-000000000008',
                               '10000000-0000-4000-8000-000000000010')
    ) x
   where objetivo <> cantidad;

  insert into existencias (tenant_id, producto_id, cantidad)
  select t, producto_id, sum(cantidad) from movimientos where tenant_id = t group by producto_id
  on conflict (tenant_id, producto_id) do update set cantidad = excluded.cantidad;
end
$$;

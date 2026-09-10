-- Datos para el demo. No correr en producción.
insert into productos (tenant_id, codigo_barras, nombre, categoria, unidad, precio, costo)
values
  ('00000000-0000-0000-0000-000000000001', '7702001010011', 'Arroz Diana 500 g',      'abarrotes', 'unidad', 3200, 2450),
  ('00000000-0000-0000-0000-000000000001', '7702001010028', 'Arroz Roa 500 g',        'abarrotes', 'unidad', 3350, 2600),
  ('00000000-0000-0000-0000-000000000001', '7702354001015', 'Leche Alquería 1 L',     'lacteos',   'unidad', 4100, 3300),
  ('00000000-0000-0000-0000-000000000001', '7702354002012', 'Leche Colanta 1 L',      'lacteos',   'unidad', 4100, 3250),
  ('00000000-0000-0000-0000-000000000001', '7701234500019', 'Aceite Girasol 1 L',     'abarrotes', 'unidad', 12900, 10100),
  ('00000000-0000-0000-0000-000000000001', null,            'Banano (kg)',            'frutas',    'kg',     3800, 2400)
on conflict do nothing;

-- Arroz Roa es reemplazo de Arroz Diana, y Colanta de Alquería.
insert into equivalencias (producto_id, equivalente_id, score)
select a.id, b.id, 0.9
  from productos a join productos b on b.categoria = a.categoria and b.id <> a.id
 where a.nombre like 'Arroz Diana%' and b.nombre like 'Arroz Roa%'
on conflict do nothing;

begin;
select plan(5);

insert into public.facilities (id, slug, name)
  values ('d0000000-0000-0000-0000-0000000000e1', 'test-bands', 'Test Bands');
insert into public.fields (id, facility_id, name, kind) values
  ('d0000000-0000-0000-0000-0000000000e2','d0000000-0000-0000-0000-0000000000e1','Campo 1','calcio5'),
  ('d0000000-0000-0000-0000-0000000000e3','d0000000-0000-0000-0000-0000000000e1','Campo 2','calcio5');

insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
  values ('d0000000-0000-0000-0000-0000000000e1','d0000000-0000-0000-0000-0000000000e2',1,540,1140,2000);

-- 1. l'ora e il giorno gia' coperti non si possono riscrivere
select throws_ok(
  $$insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
    values ('d0000000-0000-0000-0000-0000000000e1','d0000000-0000-0000-0000-0000000000e2',1,900,1200,2500)$$,
  '23P01',
  null,
  'una fascia che si sovrappone sullo stesso campo e giorno viene rifiutata');

-- 2. lo stesso orario su un altro giorno e' un caso normale
select lives_ok(
  $$insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
    values ('d0000000-0000-0000-0000-0000000000e1','d0000000-0000-0000-0000-0000000000e2',2,540,1140,2000)$$,
  'lo stesso orario su un altro giorno passa');

-- 3. e su un altro campo pure
select lives_ok(
  $$insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
    values ('d0000000-0000-0000-0000-0000000000e1','d0000000-0000-0000-0000-0000000000e3',1,540,1140,2000)$$,
  'lo stesso orario su un altro campo passa');

-- 4. due fasce che si toccano senza accavallarsi sono il caso normale:
--    l'intervallo e' chiuso a sinistra e aperto a destra
select lives_ok(
  $$insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
    values ('d0000000-0000-0000-0000-0000000000e1','d0000000-0000-0000-0000-0000000000e2',1,1140,1440,2500)$$,
  'una fascia che comincia dove finisce la precedente passa');

-- 5. il prezzo non e' piu' ambiguo: una sola fascia copre un minuto
select is(
  (select count(*)::int from public.price_bands pb
    where pb.field_id = 'd0000000-0000-0000-0000-0000000000e2'
      and pb.weekday = 1 and 1000 >= pb.starts_min and 1000 < pb.ends_min),
  1,
  'un minuto e coperto da una fascia sola');

select * from finish();
rollback;

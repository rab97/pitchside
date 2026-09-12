begin;
select plan(5);

insert into public.facilities (id, slug, name)
  values ('11111111-1111-1111-1111-111111111111', 'test', 'Test');
insert into public.fields (id, facility_id, name, kind)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Campo 1', 'calcio5');

-- stesse fasce di supabase/tests/003_price.test.sql, stesso impianto:
-- feriale 15:00–19:00 a 20 €/h, 19:00–24:00 a 25 €/h; weekend tutto il
-- giorno a 28 €/h. Cosi' i due file si confrontano riga per riga.
insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
select '11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
       d, 900, 1140, 2000 from unnest(array[1,2,3,4,5]) as d;
insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
select '11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
       d, 1140, 1440, 2500 from unnest(array[1,2,3,4,5]) as d;
insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
select '11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
       d, 540, 1440, 2800 from unnest(array[6,7]) as d;

-- martedì 14 ottobre 2025, partenza delle 20:00 per 1h30: tutta in fascia
-- serale, come in 003_price.test.sql → 37,50 euro.
select is(
  (select price_cents from public.slot_prices(
     'aaaaaaaa-0000-0000-0000-000000000001', '2025-10-14'::date, 90)
   where start_min = 1200),
  3750, 'una sola fascia: 37,50 euro'
);

-- martedì 14 ottobre, partenza delle 18:00 per 2h: a cavallo delle due
-- fasce feriali, come in 003_price.test.sql → 1h a 20 + 1h a 25 = 45,00.
select is(
  (select price_cents from public.slot_prices(
     'aaaaaaaa-0000-0000-0000-000000000001', '2025-10-14'::date, 120)
   where start_min = 1080),
  4500, 'a cavallo di due fasce: 45,00 euro'
);

-- sabato 18 ottobre, partenza delle 10:00 per 1h: fascia del weekend.
select is(
  (select price_cents from public.slot_prices(
     'aaaaaaaa-0000-0000-0000-000000000001', '2025-10-18'::date, 60)
   where start_min = 600),
  2800, 'fascia del weekend'
);

-- il numero di partenze restituite corrisponde alla finestra delle fasce
-- feriali (900–1440) allo `slot_minutes` di default della struttura (30):
-- stesso conto di freeSlots() in src/features/booking/utils/freeSlots.test.ts
-- per lo stesso orario di apertura.
select is(
  (select count(*)::integer from public.slot_prices(
     'aaaaaaaa-0000-0000-0000-000000000001', '2025-10-14'::date, 60)),
  17, 'una partenza ogni 30 minuti da 15:00 a 23:00 incluse'
);

-- la disponibilità si guarda senza account: non basta che il grant esista
-- nel catalogo, anon deve poter chiamare la RPC davvero e ricevere le righe.
set local role anon;
select is(
  (select count(*)::integer from public.slot_prices(
     'aaaaaaaa-0000-0000-0000-000000000001', '2025-10-14'::date, 60)),
  17, 'anon esegue slot_prices e riceve le partenze'
);
reset role;

select * from finish();
rollback;

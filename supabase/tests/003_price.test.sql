begin;
select plan(4);

insert into public.facilities (id, slug, name)
  values ('11111111-1111-1111-1111-111111111111', 'test', 'Test');
insert into public.fields (id, facility_id, name, kind)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Campo 1', 'calcio5');

-- feriale: 15:00–19:00 a 20 €/h, 19:00–24:00 a 25 €/h
insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
select '11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
       d, 900, 1140, 2000 from unnest(array[1,2,3,4,5]) as d;
insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
select '11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
       d, 1140, 1440, 2500 from unnest(array[1,2,3,4,5]) as d;
insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
select '11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
       d, 540, 1440, 2800 from unnest(array[6,7]) as d;

-- martedì 14 ottobre 2025, 20:00–21:30 → tutta in fascia serale: 1,5 × 25 = 37,50
select is(
  public.calc_booking_price('aaaaaaaa-0000-0000-0000-000000000001',
    tstzrange('2025-10-14 20:00+02','2025-10-14 21:30+02')),
  3750, 'una sola fascia: 37,50 euro'
);

-- martedì 14 ottobre, 18:00–20:00 → 1h a 20 + 1h a 25 = 45,00
select is(
  public.calc_booking_price('aaaaaaaa-0000-0000-0000-000000000001',
    tstzrange('2025-10-14 18:00+02','2025-10-14 20:00+02')),
  4500, 'a cavallo di due fasce: 45,00 euro'
);

-- sabato 18 ottobre, 10:00–11:00 → fascia weekend: 28,00
select is(
  public.calc_booking_price('aaaaaaaa-0000-0000-0000-000000000001',
    tstzrange('2025-10-18 10:00+02','2025-10-18 11:00+02')),
  2800, 'fascia del weekend'
);

-- Ora legale: domenica 26 ottobre 2025 l'ora torna indietro alle 03:00.
-- Uno slot serale delle 21:00 quel giorno è in fascia weekend e dura un'ora reale.
select is(
  public.calc_booking_price('aaaaaaaa-0000-0000-0000-000000000001',
    tstzrange('2025-10-26 21:00+01','2025-10-26 22:00+01')),
  2800, 'il giorno del cambio ora il prezzo resta corretto'
);

select * from finish();
rollback;

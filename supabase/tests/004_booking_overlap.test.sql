begin;
select plan(6);

-- Le date sono nel futuro e l'orizzonte è largo di proposito: create_booking
-- rifiuta il passato (P0006) e le prenotazioni oltre booking_horizon_days
-- (P0007). Con date fisse nel passato questo file fallirebbe per un motivo
-- che non c'entra nulla con la sovrapposizione, che è ciò che vuole provare.
insert into public.facilities (id, slug, name, booking_horizon_days)
  values ('11111111-1111-1111-1111-111111111111', 'test', 'Test', 3650);
insert into public.fields (id, facility_id, name, kind)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Campo 1', 'calcio5');
insert into public.price_bands (facility_id, field_id, weekdays, starts_min, ends_min, price_cents)
  values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
          '{1,2,3,4,5,6,7}', 0, 1440, 2500);
insert into public.members (id, facility_id, name, phone)
  values ('bbbbbbbb-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Rossi', '3472201563');

-- martedì 15 ottobre 2030, ora legale ancora in vigore (CEST, +02)

-- prima prenotazione: passa e calcola il prezzo
select is(
  (select price_cents from public.create_booking(
     'aaaaaaaa-0000-0000-0000-000000000001',
     tstzrange('2030-10-15 20:00+02','2030-10-15 21:30+02'),
     'bbbbbbbb-0000-0000-0000-000000000001', 'phone')),
  3750, 'la prenotazione calcola il prezzo'
);

-- sovrapposizione totale
select throws_ok(
  $$select public.create_booking(
      'aaaaaaaa-0000-0000-0000-000000000001',
      tstzrange('2030-10-15 20:00+02','2030-10-15 21:30+02'),
      'bbbbbbbb-0000-0000-0000-000000000001', 'app')$$,
  'P0004', 'Questo slot è già stato prenotato.',
  'la sovrapposizione totale è rifiutata'
);

-- sovrapposizione parziale
select throws_ok(
  $$select public.create_booking(
      'aaaaaaaa-0000-0000-0000-000000000001',
      tstzrange('2030-10-15 21:00+02','2030-10-15 22:00+02'),
      'bbbbbbbb-0000-0000-0000-000000000001', 'app')$$,
  'P0004', 'Questo slot è già stato prenotato.',
  'la sovrapposizione parziale è rifiutata'
);

-- slot adiacente: ammesso, i range sono [inizio, fine)
select lives_ok(
  $$select public.create_booking(
      'aaaaaaaa-0000-0000-0000-000000000001',
      tstzrange('2030-10-15 21:30+02','2030-10-15 22:30+02'),
      'bbbbbbbb-0000-0000-0000-000000000001', 'app')$$,
  'lo slot adiacente è ammesso'
);

-- dopo la disdetta lo slot torna libero
select lives_ok(
  $$select public.cancel_booking(
      (select id from public.bookings
        where slot = tstzrange('2030-10-15 20:00+02','2030-10-15 21:30+02')),
      'test')$$,
  'la disdetta funziona'
);
select lives_ok(
  $$select public.create_booking(
      'aaaaaaaa-0000-0000-0000-000000000001',
      tstzrange('2030-10-15 20:00+02','2030-10-15 21:30+02'),
      'bbbbbbbb-0000-0000-0000-000000000001', 'app')$$,
  'lo slot disdetto si può riprenotare'
);

select * from finish();
rollback;

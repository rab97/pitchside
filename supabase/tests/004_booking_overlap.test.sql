begin;
select plan(8);

-- Le date sono nel futuro e l'orizzonte è largo di proposito: create_booking
-- rifiuta il passato (PS006) e le prenotazioni oltre booking_horizon_days
-- (PS007). Con date fisse nel passato questo file fallirebbe per un motivo
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

-- Un amministratore vero, e ci si impersona: da superutente auth.uid() è
-- nullo e l'autorizzazione non verrebbe mai esercitata.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000',
  'e0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated',
  '390000000009', now(), '', '', '', '', now(), now());
insert into public.facility_admins (facility_id, user_id)
  values ('11111111-1111-1111-1111-111111111111',
          'e0000000-0000-0000-0000-00000000000a');

set local role authenticated;
set local request.jwt.claims to '{"sub":"e0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

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
  'PS004', 'Questo slot è già stato prenotato.',
  'la sovrapposizione totale è rifiutata'
);

-- sovrapposizione parziale
select throws_ok(
  $$select public.create_booking(
      'aaaaaaaa-0000-0000-0000-000000000001',
      tstzrange('2030-10-15 21:00+02','2030-10-15 22:00+02'),
      'bbbbbbbb-0000-0000-0000-000000000001', 'app')$$,
  'PS004', 'Questo slot è già stato prenotato.',
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

-- L'orizzonte di prenotazione limita il cliente, non il gestore: senza questa
-- distinzione una ricorrenza di stagione perderebbe tutte le date oltre i 60
-- giorni, che sono quasi tutte.
-- Preparazione di superutente: nessuna di queste tabelle ha una policy di
-- INSERT per authenticated, quindi si torna al ruolo di default finché non
-- si è finito, poi si rientra nei panni del gestore.
reset role;
insert into public.facilities (id, slug, name, booking_horizon_days)
  values ('99999999-9999-9999-9999-999999999999', 'stretta', 'Orizzonte stretto', 30);
insert into public.facility_admins (facility_id, user_id)
  values ('99999999-9999-9999-9999-999999999999',
          'e0000000-0000-0000-0000-00000000000a');
insert into public.fields (id, facility_id, name, kind)
  values ('aaaaaaaa-0000-0000-0000-000000000009',
          '99999999-9999-9999-9999-999999999999', 'Campo 1', 'calcio5');
insert into public.price_bands (facility_id, field_id, weekdays, starts_min, ends_min, price_cents)
  values ('99999999-9999-9999-9999-999999999999','aaaaaaaa-0000-0000-0000-000000000009',
          '{1,2,3,4,5,6,7}', 0, 1440, 2500);
insert into public.members (id, facility_id, name)
  values ('bbbbbbbb-0000-0000-0000-000000000009',
          '99999999-9999-9999-9999-999999999999', 'Gruppo del martedì');

set local role authenticated;
set local request.jwt.claims to '{"sub":"e0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select throws_ok(
  $$select public.create_booking(
      'aaaaaaaa-0000-0000-0000-000000000009',
      tstzrange(now() + interval '200 days', now() + interval '200 days 1 hour'),
      'bbbbbbbb-0000-0000-0000-000000000009', 'app')$$,
  'PS007', 'Si può prenotare al massimo 30 giorni in anticipo.',
  'dall app l orizzonte vale'
);

select lives_ok(
  $$select public.create_booking(
      'aaaaaaaa-0000-0000-0000-000000000009',
      tstzrange(now() + interval '200 days', now() + interval '200 days 1 hour'),
      'bbbbbbbb-0000-0000-0000-000000000009', 'recurrence')$$,
  'per una ricorrenza del gestore l orizzonte non vale'
);

reset role;
select * from finish();
rollback;

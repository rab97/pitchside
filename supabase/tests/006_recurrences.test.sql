begin;
select plan(4);

-- Orizzonte largo e date nel futuro: generate_recurrence passa da
-- create_booking, che rifiuta il passato e le date oltre booking_horizon_days.
insert into public.facilities (id, slug, name, booking_horizon_days)
  values ('11111111-1111-1111-1111-111111111111', 'test', 'Test', 3650);
insert into public.fields (id, facility_id, name, kind)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Campo 1', 'calcio5');
insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
select '11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
       d, 0, 1440, 2500 from generate_series(1, 7) as d;
insert into public.members (id, facility_id, name)
  values ('bbbbbbbb-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Amici del Martedì');

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

-- ogni martedì di novembre 2030: 5, 12, 19, 26 → 4 occorrenze
insert into public.recurrences (id, facility_id, field_id, member_id,
  weekday, start_min, duration_minutes, from_date, to_date)
values ('cccccccc-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001',
        2, 1260, 90, '2030-11-01', '2030-11-30');

select is(
  (select created from public.generate_recurrence('cccccccc-0000-0000-0000-000000000001')),
  4, 'genera quattro martedì'
);

select is(
  (select count(*)::integer from public.bookings
    where recurrence_id = 'cccccccc-0000-0000-0000-000000000001'),
  4, 'le occorrenze sono prenotazioni normali'
);

-- cancellare una occorrenza non tocca le altre
select public.cancel_booking(
  (select id from public.bookings
    where recurrence_id = 'cccccccc-0000-0000-0000-000000000001'
    order by slot limit 1), 'test');
select is(
  (select count(*)::integer from public.bookings
    where recurrence_id = 'cccccccc-0000-0000-0000-000000000001'
      and status = 'active'),
  3, 'cancellare una occorrenza lascia le altre'
);

-- Una data gia' occupata non ferma la generazione: si salta e si segnala.
-- E' il caso che il gestore deve vedere, altrimenti crede di aver bloccato
-- la stagione e scopre il buco a gennaio.
insert into public.recurrences (id, facility_id, field_id, member_id,
  weekday, start_min, duration_minutes, from_date, to_date)
values ('cccccccc-0000-0000-0000-000000000002',
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001',
        2, 1260, 90, '2030-11-01', '2030-11-30');

select is(
  (select skipped_dates from public.generate_recurrence('cccccccc-0000-0000-0000-000000000002')),
  array['2030-11-12','2030-11-19','2030-11-26']::date[],
  'le date occupate sono saltate e riportate una per una'
);

reset role;
select * from finish();
rollback;

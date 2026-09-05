begin;
select plan(4);

-- Orizzonte largo e date nel futuro: generate_recurrence passa da
-- create_booking, che rifiuta il passato e le date oltre booking_horizon_days.
insert into public.facilities (id, slug, name, booking_horizon_days)
  values ('11111111-1111-1111-1111-111111111111', 'test', 'Test', 3650);
insert into public.fields (id, facility_id, name, kind)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Campo 1', 'calcio5');
insert into public.price_bands (facility_id, field_id, weekdays, starts_min, ends_min, price_cents)
  values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
          '{1,2,3,4,5,6,7}', 0, 1440, 2500);
insert into public.members (id, facility_id, name)
  values ('bbbbbbbb-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Amici del Martedì');

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

select * from finish();
rollback;

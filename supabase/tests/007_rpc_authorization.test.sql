begin;
select plan(5);

insert into public.facilities (id, slug, name, booking_horizon_days)
  values ('d0000000-0000-0000-0000-000000000001', 'test', 'Test', 3650);
insert into public.fields (id, facility_id, name, kind)
  values ('d0000000-0000-0000-0000-0000000000f1',
          'd0000000-0000-0000-0000-000000000001', 'Campo 1', 'calcio5');
insert into public.price_bands (facility_id, field_id, weekdays, starts_min, ends_min, price_cents)
  values ('d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-0000000000f1',
          '{1,2,3,4,5,6,7}', 0, 1440, 2500);

-- tre identità: un gestore, il proprietario della prenotazione, un estraneo
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000a',
   'authenticated','authenticated','390000000001', now(), '','','','', now(), now()),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000b',
   'authenticated','authenticated','390000000002', now(), '','','','', now(), now()),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000c',
   'authenticated','authenticated','390000000003', now(), '','','','', now(), now());

insert into public.facility_admins (facility_id, user_id)
  values ('d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a');

insert into public.members (id, facility_id, user_id, name) values
  ('d0000000-0000-0000-0000-0000000000b1','d0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-00000000000b','Proprietario'),
  ('d0000000-0000-0000-0000-0000000000c1','d0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-00000000000c','Estraneo');

-- il gestore crea una prenotazione per il proprietario
set local role authenticated;
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$select public.create_booking('d0000000-0000-0000-0000-0000000000f1',
      tstzrange(now() + interval '10 days', now() + interval '10 days 1 hour'),
      'd0000000-0000-0000-0000-0000000000b1', 'phone')$$,
  'il gestore prenota per conto di un cliente'
);

-- L'id si cattura ora, mentre chi guarda è il gestore che la vede per
-- bookings_read_admin: più avanti la si passa a chi non potrebbe vederla
-- da sé, esattamente come l'attacco reale, che l'id ce l'ha già.
select set_config('test.booking_id', id::text, true)
  from public.bookings where member_id = 'd0000000-0000-0000-0000-0000000000b1';

-- l'estraneo non può prenotare a nome del proprietario
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

select throws_ok(
  $$select public.create_booking('d0000000-0000-0000-0000-0000000000f1',
      tstzrange(now() + interval '11 days', now() + interval '11 days 1 hour'),
      'd0000000-0000-0000-0000-0000000000b1', 'app')$$,
  'PS013', 'Non puoi prenotare a nome di un altro.',
  'un estraneo non prenota a nome di un altro'
);

-- ma può prenotare per sé
select lives_ok(
  $$select public.create_booking('d0000000-0000-0000-0000-0000000000f1',
      tstzrange(now() + interval '12 days', now() + interval '12 days 1 hour'),
      'd0000000-0000-0000-0000-0000000000c1', 'app')$$,
  'un cliente prenota per sé'
);

-- IL CASO CHE CONTA: l'estraneo non può disdire la prenotazione di un altro
select throws_ok(
  $$select public.cancel_booking(current_setting('test.booking_id')::uuid, 'furto')$$,
  'PS013', 'Non puoi disdire la prenotazione di un altro.',
  'un estraneo non disdice la prenotazione di un altro'
);

-- il proprietario sì
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select lives_ok(
  $$select public.cancel_booking(current_setting('test.booking_id')::uuid, 'ci ripenso')$$,
  'il proprietario disdice la propria'
);

reset role;
select * from finish();
rollback;

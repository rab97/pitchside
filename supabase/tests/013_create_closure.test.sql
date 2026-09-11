begin;
select plan(13);

insert into public.facilities (id, slug, name, booking_horizon_days)
  values ('d0000000-0000-0000-0000-0000000000c1', 'test-clo', 'Test Chiusure', 3650);
insert into public.fields (id, facility_id, name, kind) values
  ('d0000000-0000-0000-0000-0000000000c2','d0000000-0000-0000-0000-0000000000c1','Campo 1','calcio5'),
  ('d0000000-0000-0000-0000-0000000000c3','d0000000-0000-0000-0000-0000000000c1','Campo 2','calcio5');
insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
select 'd0000000-0000-0000-0000-0000000000c1', f.id, d, 0, 1440, 2500
  from public.fields f cross join generate_series(1,7) as d
 where f.facility_id = 'd0000000-0000-0000-0000-0000000000c1';

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-0000000000ca',
   'authenticated','authenticated','390000000101', now(), '','','','', now(), now()),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-0000000000cb',
   'authenticated','authenticated','390000000102', now(), '','','','', now(), now());

insert into public.facility_admins (facility_id, user_id)
  values ('d0000000-0000-0000-0000-0000000000c1','d0000000-0000-0000-0000-0000000000ca');

insert into public.members (id, facility_id, name, honored_count, missed_count)
  values ('d0000000-0000-0000-0000-0000000000c0','d0000000-0000-0000-0000-0000000000c1',
          'Cliente', 4, 1);

-- tre prenotazioni: una dentro il periodo sul campo che si chiude, una dentro
-- ma su un altro campo, una gia' disdetta, piu' una fuori dal periodo
insert into public.bookings (id, facility_id, field_id, member_id, slot, status, price_cents, cancel_deadline)
values
  ('d0000000-0000-0000-0000-0000000000b1','d0000000-0000-0000-0000-0000000000c1',
   'd0000000-0000-0000-0000-0000000000c2','d0000000-0000-0000-0000-0000000000c0',
   tstzrange(now() + interval '2 days', now() + interval '2 days 1 hour'),
   'active', 2500, now() + interval '1 day'),
  ('d0000000-0000-0000-0000-0000000000b2','d0000000-0000-0000-0000-0000000000c1',
   'd0000000-0000-0000-0000-0000000000c3','d0000000-0000-0000-0000-0000000000c0',
   tstzrange(now() + interval '2 days', now() + interval '2 days 1 hour'),
   'active', 2500, now() + interval '1 day'),
  ('d0000000-0000-0000-0000-0000000000b3','d0000000-0000-0000-0000-0000000000c1',
   'd0000000-0000-0000-0000-0000000000c2','d0000000-0000-0000-0000-0000000000c0',
   tstzrange(now() + interval '2 days 2 hours', now() + interval '2 days 3 hours'),
   'cancelled', 2500, now() + interval '1 day'),
  ('d0000000-0000-0000-0000-0000000000b4','d0000000-0000-0000-0000-0000000000c1',
   'd0000000-0000-0000-0000-0000000000c2','d0000000-0000-0000-0000-0000000000c0',
   tstzrange(now() + interval '5 days', now() + interval '5 days 1 hour'),
   'active', 2500, now() + interval '1 day');

set local role authenticated;

-- chi non e' amministratore non chiude niente
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-0000000000cb","role":"authenticated"}';
select throws_ok(
  $$select public.create_closure('d0000000-0000-0000-0000-0000000000c1',
      'd0000000-0000-0000-0000-0000000000c2',
      tstzrange(now() + interval '2 days', now() + interval '2 days 4 hours'), 'prova')$$,
  'PS016', null, 'un non amministratore non puo creare una chiusura');

-- Verify the booking is still active by checking as admin
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-0000000000ca","role":"authenticated"}';
select is((select status from public.bookings where id = 'd0000000-0000-0000-0000-0000000000b1'),
  'active', 'e la prenotazione e ancora attiva');

-- l'amministratore chiude, e disdice solo cio' che va disdetto
-- (JWT is already set to admin from previous step)
select is(
  public.create_closure('d0000000-0000-0000-0000-0000000000c1',
    'd0000000-0000-0000-0000-0000000000c2',
    tstzrange(now() + interval '2 days', now() + interval '2 days 4 hours'), 'tubo rotto'),
  1,
  'disdice la sola prenotazione attiva del campo chiuso');

select is((select status from public.bookings where id = 'd0000000-0000-0000-0000-0000000000b1'),
  'cancelled', 'quella dentro il periodo e disdetta');
select is((select status from public.bookings where id = 'd0000000-0000-0000-0000-0000000000b2'),
  'active', 'quella di un altro campo resta attiva');

-- ha chiuso il gestore: l'affidabilita' del cliente non c'entra
select results_eq(
  $$select honored_count, missed_count from public.members
     where id = 'd0000000-0000-0000-0000-0000000000c0'$$,
  $$values (4, 1)$$,
  'i contatori del cliente non si toccano');

select is((select count(*)::int from public.closures
            where facility_id = 'd0000000-0000-0000-0000-0000000000c1'),
  1, 'la chiusura e stata scritta');

-- b4 is on the closed field but outside the period, so it should still be active
select is((select status from public.bookings where id = 'd0000000-0000-0000-0000-0000000000b4'),
  'active', 'prenotazione sul campo chiuso ma fuori dal periodo resta attiva');

-- Test whole-facility closure (p_field_id = null)
-- Period covers both b2 (Campo 2, now() + 2 days) and b4 (Campo 1, now() + 5 days)
select is(
  public.create_closure('d0000000-0000-0000-0000-0000000000c1',
    null,
    tstzrange(now() + interval '2 days', now() + interval '5 days 2 hours'), 'manutenzione generale'),
  2,
  'chiusura di tutto l''impianto cancella prenotazioni su campi diversi');

select is((select status from public.bookings where id = 'd0000000-0000-0000-0000-0000000000b2'),
  'cancelled', 'prenotazione su altro campo e disdetta dalla chiusura d''impianto');
select is((select status from public.bookings where id = 'd0000000-0000-0000-0000-0000000000b4'),
  'cancelled', 'prenotazione fuori dal periodo iniziale ma dentro il secondo e disdetta');

-- Member counters should remain unchanged even after whole-facility closure
select results_eq(
  $$select honored_count, missed_count from public.members
     where id = 'd0000000-0000-0000-0000-0000000000c0'$$,
  $$values (4, 1)$$,
  'i contatori non si toccano nemmeno dopo chiusura d''impianto');

select is((select count(*)::int from public.closures
            where facility_id = 'd0000000-0000-0000-0000-0000000000c1'),
  2, 'due chiusure scritte');

reset role;
select * from finish();
rollback;

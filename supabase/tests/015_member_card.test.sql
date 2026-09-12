begin;
select plan(9);

insert into public.facilities (id, slug, name, booking_horizon_days) values
  ('e2000000-0000-0000-0000-0000000000f1', 'test-card', 'Struttura Card', 3650),
  ('e2000000-0000-0000-0000-0000000000f2', 'test-card-b', 'Struttura Card B', 3650);
insert into public.fields (id, facility_id, name, kind) values
  ('e2000000-0000-0000-0000-0000000000d1','e2000000-0000-0000-0000-0000000000f1','Campo 1','calcio5'),
  ('e2000000-0000-0000-0000-0000000000d2','e2000000-0000-0000-0000-0000000000f1','Campo 2','calcio5');

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','e2000000-0000-0000-0000-0000000000aa',
   'authenticated','authenticated','390000000301', now(), '','','','', now(), now()),
  ('00000000-0000-0000-0000-000000000000','e2000000-0000-0000-0000-0000000000bb',
   'authenticated','authenticated','390000000302', now(), '','','','', now(), now()),
  ('00000000-0000-0000-0000-000000000000','e2000000-0000-0000-0000-0000000000cc',
   'authenticated','authenticated','390000000303', now(), '','','','', now(), now());
insert into public.facility_admins (facility_id, user_id) values
  ('e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000aa'),
  ('e2000000-0000-0000-0000-0000000000f2','e2000000-0000-0000-0000-0000000000bb');

-- Il socio ha rivendicato la sua scheda (user_id valorizzato): può leggerla
-- lui stesso via members_read_own, ma non deve leggere le note del gestore
-- attraverso member_card.
insert into public.members (id, facility_id, user_id, name, phone, price_list, notes, honored_count, missed_count) values
  ('e2000000-0000-0000-0000-0000000000c1','e2000000-0000-0000-0000-0000000000f1', null,
   'Abbonato Storico','3331110000','ridotto','Paga sempre in contanti', 0, 1),
  ('e2000000-0000-0000-0000-0000000000c2','e2000000-0000-0000-0000-0000000000f1', null,
   'Cliente Nuovo', '3331110001','standard', null, 0, 0),
  ('e2000000-0000-0000-0000-0000000000c3','e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000cc',
   'Socio Rivendicato', '3331110002','standard','Nota interna riservata', 0, 0);

-- Due partite passate sul Campo 1, una sul Campo 2, una futura e una disdetta:
-- le presenze sono 3, il campo abituale è il Campo 1.
insert into public.bookings (facility_id, field_id, member_id, slot, status, price_cents, cancel_deadline) values
  ('e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000d1','e2000000-0000-0000-0000-0000000000c1',
   tstzrange(now() - interval '20 days', now() - interval '20 days' + interval '1 hour'), 'active', 2500, now() - interval '21 days'),
  ('e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000d1','e2000000-0000-0000-0000-0000000000c1',
   tstzrange(now() - interval '10 days', now() - interval '10 days' + interval '1 hour'), 'active', 2500, now() - interval '11 days'),
  ('e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000d2','e2000000-0000-0000-0000-0000000000c1',
   tstzrange(now() - interval '5 days', now() - interval '5 days' + interval '1 hour'), 'active', 2500, now() - interval '6 days'),
  ('e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000d1','e2000000-0000-0000-0000-0000000000c1',
   tstzrange(now() + interval '3 days', now() + interval '3 days' + interval '1 hour'), 'active', 2500, now() + interval '2 days'),
  ('e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000d1','e2000000-0000-0000-0000-0000000000c1',
   tstzrange(now() - interval '2 days', now() - interval '2 days' + interval '1 hour'), 'cancelled', 2500, now() - interval '3 days');

set local role authenticated;
set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-0000000000aa","role":"authenticated"}';

select is(
  (select appearances from public.member_card('e2000000-0000-0000-0000-0000000000c1')),
  3, 'le presenze contano le prenotazioni passate non disdette, e non quelle future');

select is(
  (select missed from public.member_card('e2000000-0000-0000-0000-0000000000c1')),
  1, 'le mancate presentazioni arrivano dal contatore, che viene davvero incrementato');

select is(
  (select usual_field_name from public.member_card('e2000000-0000-0000-0000-0000000000c1')),
  'Campo 1', 'il campo abituale è quello scelto più spesso');

select ok(
  (select last_played from public.member_card('e2000000-0000-0000-0000-0000000000c1'))
    < now() - interval '4 days',
  'l''ultima volta è la partita passata più recente, non quella prenotata per la settimana prossima');

select is(
  (select notes from public.member_card('e2000000-0000-0000-0000-0000000000c1')),
  'Paga sempre in contanti', 'le note interne arrivano al gestore');

select is(
  (select appearances from public.member_card('e2000000-0000-0000-0000-0000000000c2')),
  0, 'un cliente senza storia ha zero presenze, e la riga esiste lo stesso');

select is(
  (select usual_field_name from public.member_card('e2000000-0000-0000-0000-0000000000c2')),
  null, 'senza partite non c''è un campo abituale, e non si inventa');

set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-0000000000bb","role":"authenticated"}';

select is_empty(
  $$select * from public.member_card('e2000000-0000-0000-0000-0000000000c1')$$,
  'un gestore non vede la scheda di un cliente di una struttura che non amministra, note comprese');

set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-0000000000cc","role":"authenticated"}';

select is_empty(
  $$select * from public.member_card('e2000000-0000-0000-0000-0000000000c3')$$,
  'un socio che ha rivendicato la propria scheda non legge la propria nota interna attraverso member_card');

select * from finish();
rollback;

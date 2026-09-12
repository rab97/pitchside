begin;
select plan(9);

insert into public.facilities (id, slug, name, booking_horizon_days) values
  ('e1000000-0000-0000-0000-0000000000f1', 'test-search-a', 'Struttura A', 3650),
  ('e1000000-0000-0000-0000-0000000000f2', 'test-search-b', 'Struttura B', 3650);
insert into public.fields (id, facility_id, name, kind) values
  ('e1000000-0000-0000-0000-0000000000fd','e1000000-0000-0000-0000-0000000000f1','Campo 1','calcio5');

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-0000000000aa',
   'authenticated','authenticated','390000000201', now(), '','','','', now(), now());
insert into public.facility_admins (facility_id, user_id)
  values ('e1000000-0000-0000-0000-0000000000f1','e1000000-0000-0000-0000-0000000000aa');

-- Rossi ha il numero esatto; Rossini comincia con le stesse cifre; Nicolò
-- serve agli accenti; De Rossi contiene «rossi» ma non ci comincia; Marco sta
-- nell'altra struttura con lo stesso numero di Rossi, e non deve mai uscire.
insert into public.members (id, facility_id, name, phone, missed_count) values
  ('e1000000-0000-0000-0000-0000000000c1','e1000000-0000-0000-0000-0000000000f1','Rossi Luca','3331112233', 0),
  ('e1000000-0000-0000-0000-0000000000c2','e1000000-0000-0000-0000-0000000000f1','Rossini Ada','3331112299', 2),
  ('e1000000-0000-0000-0000-0000000000c3','e1000000-0000-0000-0000-0000000000f1','Nicolò Bianchi','3339990000', 0),
  ('e1000000-0000-0000-0000-0000000000c4','e1000000-0000-0000-0000-0000000000f1','De Rossi Ugo', null, 0),
  ('e1000000-0000-0000-0000-0000000000c5','e1000000-0000-0000-0000-0000000000f2','Marco Neri','3331112233', 0);

-- De Rossi ha giocato ieri, Rossi Luca un anno fa: a parità di rank il più
-- recente sta sopra, e questa è l'unica coppia che lo mette alla prova.
insert into public.bookings (facility_id, field_id, member_id, slot, status, price_cents, cancel_deadline) values
  ('e1000000-0000-0000-0000-0000000000f1','e1000000-0000-0000-0000-0000000000fd',
   'e1000000-0000-0000-0000-0000000000c4',
   tstzrange(now() - interval '1 day', now() - interval '1 day' + interval '1 hour'),
   'active', 2500, now() - interval '2 days'),
  ('e1000000-0000-0000-0000-0000000000f1','e1000000-0000-0000-0000-0000000000fd',
   'e1000000-0000-0000-0000-0000000000c1',
   tstzrange(now() - interval '365 days', now() - interval '365 days' + interval '1 hour'),
   'active', 2500, now() - interval '366 days');

set local role authenticated;
set local request.jwt.claims to '{"sub":"e1000000-0000-0000-0000-0000000000aa","role":"authenticated"}';

select is(
  (select name from public.search_members('e1000000-0000-0000-0000-0000000000f1','3331112233') limit 1),
  'Rossi Luca',
  'il telefono esatto vince su tutto');

select is(
  (select array_agg(name order by ord) from (
     select name, row_number() over () as ord
       from public.search_members('e1000000-0000-0000-0000-0000000000f1','333111')) s),
  array['Rossi Luca','Rossini Ada'],
  'il prefisso del telefono trova entrambi, in ordine di indice');

select is(
  (select rank from public.search_members('e1000000-0000-0000-0000-0000000000f1','Rossi') where name = 'Rossi Luca'),
  3::smallint,
  'il nome che comincia per ha rank 3');

select is(
  (select rank from public.search_members('e1000000-0000-0000-0000-0000000000f1','Rossi') where name = 'De Rossi Ugo'),
  4::smallint,
  'il nome che contiene ha rank 4');

select is(
  (select name from public.search_members('e1000000-0000-0000-0000-0000000000f1','Rossi') limit 1),
  'Rossi Luca',
  'chi comincia per sta sopra a chi contiene');

select is(
  (select name from public.search_members('e1000000-0000-0000-0000-0000000000f1','Nicolo') limit 1),
  'Nicolò Bianchi',
  'gli accenti si ignorano: «Nicolo» trova «Nicolò»');

select is(
  (select has_missed from public.search_members('e1000000-0000-0000-0000-0000000000f1','Rossini') limit 1),
  true,
  'chi ha almeno una mancata presentazione è segnalato nella riga');

select is_empty(
  $$select * from public.search_members('e1000000-0000-0000-0000-0000000000f2','3331112233')$$,
  'un gestore non vede i clienti di una struttura che non amministra, nemmeno col numero esatto');

select is_empty(
  $$select * from public.search_members('e1000000-0000-0000-0000-0000000000f1','R')$$,
  'sotto i due caratteri non si cerca');

select * from finish();
rollback;

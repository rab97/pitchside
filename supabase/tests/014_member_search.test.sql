begin;
select plan(16);

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
   'authenticated','authenticated','390000000201', now(), '','','','', now(), now()),
  ('00000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-0000000000bb',
   'authenticated','authenticated','390000000202', now(), '','','','', now(), now());
insert into public.facility_admins (facility_id, user_id)
  values ('e1000000-0000-0000-0000-0000000000f1','e1000000-0000-0000-0000-0000000000aa');
-- bb non amministra niente: è un cliente che ha rivendicato la propria scheda.

-- Rossi ha il numero esatto; Rossini comincia con le stesse cifre; Nicolò
-- serve agli accenti; De Rossi contiene «rossi» ma non ci comincia; Marco sta
-- nell'altra struttura con lo stesso numero di Rossi, e non deve mai uscire.
insert into public.members (id, facility_id, name, phone, missed_count) values
  ('e1000000-0000-0000-0000-0000000000c1','e1000000-0000-0000-0000-0000000000f1','Rossi Luca','3331112233', 0),
  ('e1000000-0000-0000-0000-0000000000c2','e1000000-0000-0000-0000-0000000000f1','Rossini Ada','3331112299', 2),
  ('e1000000-0000-0000-0000-0000000000c3','e1000000-0000-0000-0000-0000000000f1','Nicolò Bianchi','3339990000', 0),
  ('e1000000-0000-0000-0000-0000000000c4','e1000000-0000-0000-0000-0000000000f1','De Rossi Ugo', null, 0),
  ('e1000000-0000-0000-0000-0000000000c5','e1000000-0000-0000-0000-0000000000f2','Marco Neri','3331112233', 0);

-- Verdi ha rivendicato la sua scheda: `members_read_own` gliela fa leggere, e
-- quindi la fa arrivare anche a `search_members`, che non è SECURITY DEFINER.
-- Il nome sta lontano dagli altri apposta, così le asserzioni di sopra non
-- cambiano di significato.
insert into public.members (id, facility_id, user_id, name, phone, missed_count) values
  ('e1000000-0000-0000-0000-0000000000c6','e1000000-0000-0000-0000-0000000000f1',
   'e1000000-0000-0000-0000-0000000000bb','Verdi Rivendicato','3337770000', 0);

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

-- Il numero che il gestore ha davvero davanti. Il chiamante arriva dal
-- caller ID, che su un telefono italiano lo scrive «+39 333 111 2233»; la
-- riga in members tiene «3331112233». Confrontare dodici cifre con dieci non
-- trovava nessuno, cioè proprio sull'ingresso più probabile di tutti.
select is(
  (select name from public.search_members('e1000000-0000-0000-0000-0000000000f1','+39 333 111 2233') limit 1),
  'Rossi Luca',
  'il numero scritto col prefisso trova la stessa riga delle dieci cifre nude');

select is(
  (select rank from public.search_members('e1000000-0000-0000-0000-0000000000f1','+39 333 111 2233') where name = 'Rossi Luca'),
  1::smallint,
  'col prefisso resta una corrispondenza esatta, rank 1: il numero intero vince su tutto come prima');

select is(
  (select name from public.search_members('e1000000-0000-0000-0000-0000000000f1','0039 333 111 2233') limit 1),
  'Rossi Luca',
  'anche scritto 0039, perché a normalizzare è phone_key e non un conteggio di cifre scritto a mano');

-- La troncatura non deve toccare quello che sta sotto le dieci cifre: è il
-- prefisso letto ad alta voce mentre il cliente detta il numero, ed è ciò che
-- rende utile il campo prima che il numero sia finito.
select is(
  (select array_agg(name) from public.search_members('e1000000-0000-0000-0000-0000000000f1','3339')),
  array['Nicolò Bianchi'],
  'un numero parziale continua a restringere invece di prendere tutto');

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

-- Le tre asserzioni che seguono stanno qui perché il commento in
-- 0020_member_search.sql diceva il falso: «la RLS su members ammette esattamente
-- il gestore della struttura». Non è così — `members_read_own` ammette anche il
-- cliente che ha rivendicato la propria riga, e quindi questa funzione è
-- raggiungibile da lui. Oggi è innocuo: le colonne che escono sono sue. Domani
-- non lo è più, se qualcuno ci aggiunge `notes` o `price_list` leggendo quel
-- commento e concludendo che la funzione è solo del gestore.
set local request.jwt.claims to '{"sub":"e1000000-0000-0000-0000-0000000000bb","role":"authenticated"}';

select is(
  (select array_agg(name) from public.search_members('e1000000-0000-0000-0000-0000000000f1','Verdi')),
  array['Verdi Rivendicato'],
  'un cliente che ha rivendicato la scheda raggiunge search_members, e ne esce la sua riga: la funzione non è solo del gestore');

select is_empty(
  $$select * from public.search_members('e1000000-0000-0000-0000-0000000000f1','Rossi')$$,
  'dalle righe degli altri però non esce niente: quello che legge è solo suo');

select is(
  (select array_agg(x.name order by x.ord)
     from pg_proc p,
          unnest(p.proargnames, p.proargmodes) with ordinality as x(name, mode, ord)
    where p.oid = 'public.search_members(uuid,text)'::regprocedure
      and x.mode = 't'),
  array['id','name','phone','has_missed','rank'],
  'le colonne di ritorno sono queste cinque: aggiungerne una del gestore la consegnerebbe al cliente delle due asserzioni qui sopra, e va fatto solo con un predicato is_facility_admin come in member_card');

select * from finish();
rollback;

begin;
select plan(19);

-- Il caso della specifica §5.4: «chi ha prenotato per anni al telefono
-- ritrova il suo storico al primo accesso, senza che nessuno faccia niente».
-- Le prove qui sotto seguono l'ordine dell'app, che chiama `ensure_my_member`
-- da una `useQuery` — cioè appena esiste una sessione, PRIMA che la
-- rivendicazione abbia avuto la sua occasione — e con entrambe le grafie del
-- numero, con gli spazi e senza: quale delle due usi il gestore non deve
-- cambiare niente.

insert into public.facilities (id, slug, name) values
  ('c0000000-0000-0000-0000-00000000aa01', 'uno', 'Uno'),
  ('c0000000-0000-0000-0000-00000000aa02', 'due', 'Due'),
  ('c0000000-0000-0000-0000-00000000aa03', 'tre', 'Tre'),
  ('c0000000-0000-0000-0000-00000000aa04', 'quattro', 'Quattro');

insert into public.fields (id, facility_id, name, kind) values
  ('c0000000-0000-0000-0000-0000000000f1',
   'c0000000-0000-0000-0000-00000000aa01', 'Campo 1', 'calcio5'),
  ('c0000000-0000-0000-0000-0000000000f3',
   'c0000000-0000-0000-0000-00000000aa03', 'Campo 1', 'calcio5');

-- Numeri diversi da quello del gestore del seed (393472201563): quello è
-- già in auth.users, e la colonna phone è unica in tutto lo schema auth.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  -- chi entra via SMS: il numero è già verificato al primo accesso
  ('00000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-00000000bb01', 'authenticated', 'authenticated',
   '393492223344', now(), '', '', '', '', now(), now()),
  -- chi entra con Google: nessun numero, arriverà dopo
  ('00000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-00000000bb02', 'authenticated', 'authenticated',
   null, null, '', '', '', '', now(), now()),
  -- chi ha già una scheda sua, con una storia, nella struttura del doppione
  ('00000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-00000000bb03', 'authenticated', 'authenticated',
   '393355566778', now(), '', '', '', '', now(), now()),
  -- autenticato ma senza telefono verificato: ramo PS014
  ('00000000-0000-0000-0000-000000000000',
   'c0000000-0000-0000-0000-00000000bb04', 'authenticated', 'authenticated',
   null, null, '', '', '', '', now(), now());

-- Le schede che il gestore ha creato al telefono negli anni. In aa01 il
-- numero è scritto come lo scrive gotrue, in aa02 come lo scrive una persona:
-- è la differenza che prima decideva quale dei due difetti capitava.
insert into public.members (id, facility_id, name, phone) values
  ('c0000000-0000-0000-0000-0000000000d1',
   'c0000000-0000-0000-0000-00000000aa01', 'Storico Senza Spazi', '3492223344'),
  ('c0000000-0000-0000-0000-0000000000d2',
   'c0000000-0000-0000-0000-00000000aa02', 'Storico Con Spazi', '349 222 33 44');
-- e una di un'altra persona, che non deve essere toccata
insert into public.members (facility_id, name, phone) values
  ('c0000000-0000-0000-0000-00000000aa01', 'Altro', '3331234567');

-- Le prenotazioni prese al telefono: sono *queste* che il cliente deve
-- ritrovare. Inserimento diretto, da superutente: passare da create_booking
-- richiederebbe fasce, orizzonte e un gestore, che qui non c'entrano.
insert into public.bookings
  (facility_id, field_id, member_id, slot, source, price_cents, cancel_deadline)
values
  ('c0000000-0000-0000-0000-00000000aa01', 'c0000000-0000-0000-0000-0000000000f1',
   'c0000000-0000-0000-0000-0000000000d1',
   tstzrange(now() + interval '3 days', now() + interval '3 days 1 hour'),
   'phone', 2500, now() + interval '2 days');

-- ---------------------------------------------------------------------------
-- Percorso SMS: il numero è verificato prima di qualunque cosa, ed è
-- `ensure_my_member` la prima funzione che l'app chiama.
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000bb01","role":"authenticated"}';

select is(
  (select public.ensure_my_member('c0000000-0000-0000-0000-00000000aa01')),
  'c0000000-0000-0000-0000-0000000000d1'::uuid,
  'ensure_my_member adotta la scheda storica invece di inserirne una seconda'
);

select is(
  (select count(*)::integer from public.members
    where facility_id = 'c0000000-0000-0000-0000-00000000aa01'
      and public.phone_key(phone) = '3492223344'),
  1, 'nella struttura resta una sola scheda per quel numero'
);

-- La promessa della fase, provata dove si vede: le prenotazioni prese al
-- telefono sono adesso leggibili da chi ha appena fatto accesso, per
-- bookings_read_own. Nessun gestore ha fatto niente.
select is(
  (select count(*)::integer from public.bookings),
  1, 'il cliente ritrova la prenotazione che aveva preso al telefono'
);

-- Stessa cosa nella struttura dove il numero è scritto con gli spazi:
-- phone_key normalizza, e adesso l'indice unico usa la stessa chiave.
select is(
  (select public.ensure_my_member('c0000000-0000-0000-0000-00000000aa02')),
  'c0000000-0000-0000-0000-0000000000d2'::uuid,
  'adotta anche la scheda col numero scritto con gli spazi'
);

-- E la rivendicazione, che nell'app arriva dopo, non ha più niente da fare e
-- non fallisce: l'ordine fra le due è diventato irrilevante.
select lives_ok(
  $$select public.claim_members_by_verified_phone()$$,
  'la rivendicazione dopo l''adozione non fallisce'
);

select is(
  (select count(*)::integer from public.members
    where user_id = 'c0000000-0000-0000-0000-00000000bb01'),
  2, 'l''account resta con una sola scheda per struttura'
);

select is(
  (select user_id from public.members where name = 'Altro'),
  null, 'la scheda di un altro non viene toccata'
);

-- ---------------------------------------------------------------------------
-- Percorso Google: al primo accesso non c'è nessun numero, quindi
-- `ensure_my_member` crea un segnaposto. Il numero arriva dopo, dal dialogo
-- che lo fa verificare, e la rivendicazione deve comunque ricongiungere.
-- ---------------------------------------------------------------------------
reset role;
insert into public.members (id, facility_id, name, phone) values
  ('c0000000-0000-0000-0000-0000000000d3',
   'c0000000-0000-0000-0000-00000000aa03', 'Storico Di Google', '3498877665');
insert into public.bookings
  (facility_id, field_id, member_id, slot, source, price_cents, cancel_deadline)
values
  ('c0000000-0000-0000-0000-00000000aa03', 'c0000000-0000-0000-0000-0000000000f3',
   'c0000000-0000-0000-0000-0000000000d3',
   tstzrange(now() + interval '4 days', now() + interval '4 days 1 hour'),
   'phone', 2500, now() + interval '3 days');

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000bb02","role":"authenticated"}';

select isnt(
  (select public.ensure_my_member('c0000000-0000-0000-0000-00000000aa03')),
  'c0000000-0000-0000-0000-0000000000d3'::uuid,
  'senza numero verificato ensure_my_member non adotta niente: crea un segnaposto'
);

-- verifyOtp: Supabase scrive il numero confermato su auth.users
reset role;
update auth.users
   set phone = '393498877665', phone_confirmed_at = now()
 where id = 'c0000000-0000-0000-0000-00000000bb02';
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000bb02","role":"authenticated"}';

select is(
  (select count(*)::integer from public.claim_members_by_verified_phone()),
  1, 'la rivendicazione collega la scheda storica anche dopo il segnaposto'
);

select is(
  (select id from public.members
    where facility_id = 'c0000000-0000-0000-0000-00000000aa03'
      and user_id = 'c0000000-0000-0000-0000-00000000bb02'),
  'c0000000-0000-0000-0000-0000000000d3'::uuid,
  'la scheda dell''account in quella struttura è quella storica'
);

select is(
  (select count(*)::integer from public.bookings
    where facility_id = 'c0000000-0000-0000-0000-00000000aa03'),
  1, 'e con essa la prenotazione presa al telefono'
);

-- ---------------------------------------------------------------------------
-- Casi negativi: non basta che il proprietario riesca, serve provare che un
-- altro (o nessuno) fallisca. Il ruolo resta authenticated — le funzioni
-- hanno grant solo a quel ruolo — ma senza "sub" nei claim auth.uid() è
-- nullo, com'è da superutente.
-- ---------------------------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"role":"authenticated"}';

select throws_ok(
  $$select public.claim_members_by_verified_phone()$$,
  'PS012', 'Devi accedere.',
  'la rivendicazione senza identità fallisce con PS012'
);

select throws_ok(
  $$select public.ensure_my_member('c0000000-0000-0000-0000-00000000aa01')$$,
  'PS012', 'Devi accedere.',
  'ensure_my_member senza identità fallisce con PS012'
);

-- Un utente autenticato ma senza telefono verificato: ramo distinto dal
-- precedente, PS012 controlla l'identità, PS014 il numero.
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000bb04","role":"authenticated"}';

select throws_ok(
  $$select public.claim_members_by_verified_phone()$$,
  'PS014', 'Il numero non è ancora verificato.',
  'la rivendicazione senza telefono verificato fallisce con PS014'
);

-- ---------------------------------------------------------------------------
-- Anti-collisione con members_facility_user_uniq. L'utente ha già una scheda
-- sua in aa01 — e non un segnaposto: ha una prenotazione — e in aa01 c'è
-- anche una scheda spaiata con lo stesso numero. Sono due storie diverse
-- della stessa persona, e fonderle non è compito di questa fase: la
-- rivendicazione deve saltare quella struttura in modo pulito, non fallire
-- tutta e non lasciare un 23505 non gestito.
-- ---------------------------------------------------------------------------
reset role;
insert into public.members (id, facility_id, user_id, name) values
  ('c0000000-0000-0000-0000-0000000000d4',
   'c0000000-0000-0000-0000-00000000aa01',
   'c0000000-0000-0000-0000-00000000bb03', 'Bb03 Titolare');
insert into public.bookings
  (facility_id, field_id, member_id, slot, source, price_cents, cancel_deadline)
values
  ('c0000000-0000-0000-0000-00000000aa01', 'c0000000-0000-0000-0000-0000000000f1',
   'c0000000-0000-0000-0000-0000000000d4',
   tstzrange(now() + interval '5 days', now() + interval '5 days 1 hour'),
   'app', 2500, now() + interval '4 days');
-- la scheda spaiata nella stessa struttura, con lo stesso numero
insert into public.members (facility_id, name, phone) values
  ('c0000000-0000-0000-0000-00000000aa01', 'Bb03 Duplicato', '3355566778');
-- e una spaiata altrove, che invece va rivendicata regolarmente
insert into public.members (facility_id, name, phone) values
  ('c0000000-0000-0000-0000-00000000aa04', 'Bb03 Altrove', '335 556 67 78');

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000bb03","role":"authenticated"}';

-- L'app chiama prima questa, ed è il punto in cui prima moriva con 23505.
select is(
  (select public.ensure_my_member('c0000000-0000-0000-0000-00000000aa01')),
  'c0000000-0000-0000-0000-0000000000d4'::uuid,
  'ensure_my_member restituisce la scheda che l''account ha già, senza 23505'
);

select lives_ok(
  $$select public.claim_members_by_verified_phone()$$,
  'una struttura già posseduta non fa fallire l''intera rivendicazione'
);

select is(
  (select count(*)::integer from public.members
    where facility_id = 'c0000000-0000-0000-0000-00000000aa01'
      and user_id = 'c0000000-0000-0000-0000-00000000bb03'),
  1, 'l''account non finisce con due schede nella stessa struttura'
);

select is(
  (select user_id from public.members where name = 'Bb03 Duplicato'),
  null,
  'la scheda spaiata resta libera: la scheda con una storia non si scavalca'
);

select is(
  (select user_id from public.members where name = 'Bb03 Altrove'),
  'c0000000-0000-0000-0000-00000000bb03',
  'la scheda in un''altra struttura viene comunque rivendicata'
);

reset role;
select * from finish();
rollback;

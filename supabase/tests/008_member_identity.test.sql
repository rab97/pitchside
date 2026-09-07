begin;
select plan(10);

insert into public.facilities (id, slug, name) values
  ('c0000000-0000-0000-0000-00000000aa01', 'uno', 'Uno'),
  ('c0000000-0000-0000-0000-00000000aa02', 'due', 'Due');

-- Numero diverso da quello del gestore del seed (393472201563): quello è
-- già in auth.users, e la colonna phone è unica in tutto lo schema auth.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-00000000bb01', 'authenticated', 'authenticated',
  '393492223344', now(), '', '', '', '', now(), now());

-- due schede create dal gestore al telefono, in due strutture diverse
insert into public.members (facility_id, name, phone) values
  ('c0000000-0000-0000-0000-00000000aa01', 'Marco Ferrero', '3492223344'),
  ('c0000000-0000-0000-0000-00000000aa02', 'Marco Ferrero', '349 222 33 44');
-- e una di un'altra persona, che non deve essere toccata
insert into public.members (facility_id, name, phone) values
  ('c0000000-0000-0000-0000-00000000aa01', 'Altro', '3331234567');

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000bb01","role":"authenticated"}';

select is(
  (select count(*)::integer from public.claim_members_by_verified_phone()),
  2, 'rivendica le due schede con quel numero, anche scritto con gli spazi'
);

select is(
  (select count(*)::integer from public.members
    where user_id = 'c0000000-0000-0000-0000-00000000bb01'),
  2, 'le schede risultano collegate all account'
);

select is(
  (select user_id from public.members where name = 'Altro'),
  null, 'la scheda di un altro non viene toccata'
);

-- in una struttura dove non ha nulla, ensure_my_member crea la scheda.
-- L'inserimento della struttura richiede di uscire dall'impersonazione:
-- facilities_write_admin non lascia scrivere un cliente qualunque.
reset role;
insert into public.facilities (id, slug, name)
  values ('c0000000-0000-0000-0000-00000000aa03', 'tre', 'Tre');
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000bb01","role":"authenticated"}';

select isnt(
  (select public.ensure_my_member('c0000000-0000-0000-0000-00000000aa03')),
  null, 'ensure_my_member crea la scheda se non c e'
);

-- Casi negativi: non basta che il proprietario riesca, serve provare che
-- un altro (o nessuno) fallisca. Il ruolo resta authenticated — le
-- funzioni hanno grant solo a quel ruolo — ma senza "sub" nei claim
-- auth.uid() è nullo, com'è da superutente.
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
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-00000000bb02', 'authenticated', 'authenticated',
  null, null, '', '', '', '', now(), now());
set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000bb02","role":"authenticated"}';

select throws_ok(
  $$select public.claim_members_by_verified_phone()$$,
  'PS014', 'Il numero non è ancora verificato.',
  'la rivendicazione senza telefono verificato fallisce con PS014'
);

-- Il cuore della difesa contro members_facility_user_uniq: l'utente ha già
-- una scheda propria in aa01, e in aa01 c'è anche una scheda spaiata con
-- lo stesso numero. Senza il filtro "not exists" nella funzione, la update
-- proverebbe ad agganciare pure quella e violerebbe l'indice unico
-- (facility_id, user_id): l'intera chiamata fallirebbe invece di limitarsi
-- a saltare quella struttura.
reset role;
insert into public.facilities (id, slug, name)
  values ('c0000000-0000-0000-0000-00000000aa04', 'quattro', 'Quattro');

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-00000000bb03', 'authenticated', 'authenticated',
  '393355566778', now(), '', '', '', '', now(), now());

-- la scheda che l'utente possiede già in aa01
insert into public.members (facility_id, user_id, name) values
  ('c0000000-0000-0000-0000-00000000aa01', 'c0000000-0000-0000-0000-00000000bb03', 'Bb03 Titolare');
-- una scheda spaiata nella stessa struttura, con lo stesso numero
insert into public.members (facility_id, name, phone) values
  ('c0000000-0000-0000-0000-00000000aa01', 'Bb03 Duplicato', '3355566778');
-- una scheda spaiata altrove, che invece va rivendicata regolarmente
insert into public.members (facility_id, name, phone) values
  ('c0000000-0000-0000-0000-00000000aa04', 'Bb03 Altrove', '335 556 67 78');

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000bb03","role":"authenticated"}';

select lives_ok(
  $$select public.claim_members_by_verified_phone()$$,
  'una struttura già posseduta non fa fallire l''intera rivendicazione'
);

select is(
  (select user_id from public.members where name = 'Bb03 Duplicato'),
  null, 'la scheda duplicata nella struttura già posseduta resta libera'
);

select is(
  (select user_id from public.members where name = 'Bb03 Altrove'),
  'c0000000-0000-0000-0000-00000000bb03',
  'la scheda in un''altra struttura viene comunque rivendicata'
);

reset role;
select * from finish();
rollback;

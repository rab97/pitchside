begin;
select plan(4);

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

reset role;
select * from finish();
rollback;

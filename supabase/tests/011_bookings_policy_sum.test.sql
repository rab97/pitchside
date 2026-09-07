begin;
select plan(3);

-- Perché `useMyBookings` e `useBooking` filtrano per `member_id`.
--
-- Le policy permissive di Postgres si sommano in OR: per un utente che è
-- insieme cliente e amministratore vale `bookings_read_own OR
-- bookings_read_admin`, e una `select` senza filtri restituisce tutte le
-- prenotazioni della struttura, non solo le sue. Non è un difetto della RLS
-- — l'amministratore ha il diritto di vedere quelle righe, ed è ciò che fa
-- funzionare la griglia del gestore — ma una schermata che promette «le tue
-- prenotazioni» ne mostrerebbe altre.
--
-- Il filtro nel client non duplica quindi una regola di sicurezza: dice
-- QUALI righe interessano a quella schermata, e la RLS resta l'unico confine
-- su cosa è leggibile. Questo test lo dimostra, perché nel seed l'owner è
-- davvero anche cliente («il gestore prenota come chiunque altro») e chi
-- venisse a «semplificare» via quel filtro credendolo un doppione
-- riaprirebbe il difetto senza che nessun test se ne accorga.

insert into public.facilities (id, slug, name)
  values ('e0000000-0000-0000-0000-000000000001', 'somma', 'Somma');
insert into public.fields (id, facility_id, name, kind)
  values ('e0000000-0000-0000-0000-0000000000f1',
          'e0000000-0000-0000-0000-000000000001', 'Campo 1', 'calcio5');

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000',
  'e0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated',
  '390000009901', now(), '', '', '', '', now(), now());

-- lo stesso utente: amministratore della struttura e cliente con una scheda
insert into public.facility_admins (facility_id, user_id) values
  ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-00000000000a');

insert into public.members (id, facility_id, user_id, name) values
  ('e0000000-0000-0000-0000-0000000000b1', 'e0000000-0000-0000-0000-000000000001',
   'e0000000-0000-0000-0000-00000000000a', 'Gestore Che Prenota');
insert into public.members (id, facility_id, name, phone) values
  ('e0000000-0000-0000-0000-0000000000b2', 'e0000000-0000-0000-0000-000000000001',
   'Un Altro Cliente', '3339998801');

insert into public.bookings
  (facility_id, field_id, member_id, slot, source, price_cents, cancel_deadline)
values
  ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000f1',
   'e0000000-0000-0000-0000-0000000000b1',
   tstzrange(now() + interval '2 days', now() + interval '2 days 1 hour'),
   'app', 2500, now() + interval '1 day'),
  ('e0000000-0000-0000-0000-000000000001', 'e0000000-0000-0000-0000-0000000000f1',
   'e0000000-0000-0000-0000-0000000000b2',
   tstzrange(now() + interval '2 days 2 hours', now() + interval '2 days 3 hours'),
   'phone', 2500, now() + interval '1 day');

set local role authenticated;
set local request.jwt.claims to '{"sub":"e0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select is(
  (select count(*)::integer from public.bookings
    where facility_id = 'e0000000-0000-0000-0000-000000000001'),
  2, 'la RLS gli mostra tutte le prenotazioni della struttura, non solo le sue'
);

select is(
  (select count(*)::integer from public.bookings
    where facility_id = 'e0000000-0000-0000-0000-000000000001'
      and member_id = 'e0000000-0000-0000-0000-0000000000b1'),
  1, 'le sue sono una: è il filtro per member_id a dirlo, non la RLS'
);

-- La riga di un altro cliente è leggibile: è esattamente ciò che finirebbe
-- in «le tue prenotazioni» senza il filtro.
select is(
  (select member_id from public.bookings
    where facility_id = 'e0000000-0000-0000-0000-000000000001'
      and member_id <> 'e0000000-0000-0000-0000-0000000000b1'),
  'e0000000-0000-0000-0000-0000000000b2'::uuid,
  'e la riga in più è quella di un altro cliente'
);

reset role;
select * from finish();
rollback;

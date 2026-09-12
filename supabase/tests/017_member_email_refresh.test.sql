begin;
select plan(4);

insert into public.facilities (id, slug, name, booking_horizon_days) values
  ('e4000000-0000-0000-0000-0000000000f1', 'test-mail-sync', 'Test Recapiti', 3650);

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, email,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  -- Ha confermato un indirizzo DOPO che la scheda era gia' nata.
  ('00000000-0000-0000-0000-000000000000','e4000000-0000-0000-0000-0000000000aa',
   'authenticated','authenticated','393334445566', now(), 'rossi@example.com',
   '','','','', now(), now()),
  -- Nessun indirizzo: la scheda non deve essere toccata.
  ('00000000-0000-0000-0000-000000000000','e4000000-0000-0000-0000-0000000000bb',
   'authenticated','authenticated','393337778899', now(), null,
   '','','','', now(), now());

-- Due schede gia' esistenti, create dal gestore e gia' rivendicate.
insert into public.members (id, facility_id, user_id, name, phone, email) values
  ('e4000000-0000-0000-0000-0000000000c1','e4000000-0000-0000-0000-0000000000f1',
   'e4000000-0000-0000-0000-0000000000aa','Rossi','3334445566', null),
  ('e4000000-0000-0000-0000-0000000000c2','e4000000-0000-0000-0000-0000000000f1',
   'e4000000-0000-0000-0000-0000000000bb','Bianchi','3337778899', 'vecchia@example.com');

-- Una scheda senza account, con un numero che corrisponde a un terzo utente:
-- serve a provare che l'adozione continua a funzionare come prima.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','e4000000-0000-0000-0000-0000000000cc',
   'authenticated','authenticated','393331112233', now(), '','','','', now(), now());
insert into public.members (id, facility_id, name, phone) values
  ('e4000000-0000-0000-0000-0000000000c3','e4000000-0000-0000-0000-0000000000f1',
   'Verdi','3331112233');

set local role authenticated;

-- La chiamata che scrive e la lettura che verifica stanno in due comandi
-- separati: dentro un solo comando, la scansione di public.members userebbe
-- lo snapshot preso all'inizio di quel comando e non vedrebbe la scrittura
-- fatta dalla sotto-query che chiama la funzione nello stesso comando.
set local request.jwt.claims to '{"sub":"e4000000-0000-0000-0000-0000000000aa","role":"authenticated"}';
select public.ensure_my_member('e4000000-0000-0000-0000-0000000000f1');
select is(
  (select email from public.members where id = 'e4000000-0000-0000-0000-0000000000c1'),
  'rossi@example.com',
  'una scheda senza indirizzo riceve quello confermato sull''account');

set local request.jwt.claims to '{"sub":"e4000000-0000-0000-0000-0000000000bb","role":"authenticated"}';
select public.ensure_my_member('e4000000-0000-0000-0000-0000000000f1');
select is(
  (select email from public.members where id = 'e4000000-0000-0000-0000-0000000000c2'),
  'vecchia@example.com',
  'un account senza indirizzo non cancella quello gia'' sulla scheda');

set local request.jwt.claims to '{"sub":"e4000000-0000-0000-0000-0000000000cc","role":"authenticated"}';
select is(
  public.ensure_my_member('e4000000-0000-0000-0000-0000000000f1'),
  'e4000000-0000-0000-0000-0000000000c3'::uuid,
  'l''adozione per numero verificato continua a funzionare');

-- Il conteggio deve vedere tutte le schede della struttura, non solo la
-- propria: senza tornare al ruolo di default, members_read_own la
-- restringerebbe alla sola riga di chi ha appena chiamato la funzione.
reset role;
select is(
  (select count(*)::integer from public.members
    where facility_id = 'e4000000-0000-0000-0000-0000000000f1'),
  3,
  'nessuna scheda in piu'' e'' stata creata da queste chiamate');

select * from finish();
rollback;

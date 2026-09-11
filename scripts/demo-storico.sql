-- Prepara uno storico da ritrovare, per provare a mano il ricongiungimento.
--
-- Il seed crea le schede clienti ma nessuna prenotazione, quindi «ritrova il
-- tuo storico» mostrerebbe una lista vuota — vero ma non convincente. Questo
-- script dà a Giulio Dante (scheda storica senza account, telefono 3394128807)
-- tre prenotazioni passate e una futura, come se il gestore le avesse prese al
-- telefono negli scorsi mesi.
--
-- Uso:
--   docker exec -i supabase_db_pitchside psql -U postgres -d postgres \
--     < scripts/demo-storico.sql
--
-- Poi si entra nell'app col numero 339 412 88 07 e codice 472839.
-- Per tornare allo stato pulito: npm run db:reset
--
-- Nota: inserisce direttamente in `bookings`, cosa che al client è vietata
-- (solo RPC). Qui è lecito per due ragioni: gira come `postgres` in psql, come
-- fa il seed, e crea prenotazioni nel PASSATO, che `create_booking` rifiuta
-- per progetto. È uno strumento di prova, non una scorciatoia di produzione.

\set giulio '(select id from public.members where phone = ''3394128807'')'

insert into public.bookings
  (facility_id, field_id, member_id, slot, status, source, price_cents, cancel_deadline, created_at)
select
  'f0000000-0000-0000-0000-000000000001',
  f.field_id,
  :giulio,
  tstzrange(
    ((current_date - f.giorni_fa) + time '21:00') at time zone 'Europe/Rome',
    ((current_date - f.giorni_fa) + time '22:00') at time zone 'Europe/Rome'
  ),
  f.stato,
  'phone',
  f.prezzo,
  ((current_date - f.giorni_fa) + time '21:00') at time zone 'Europe/Rome'
    - interval '24 hours',
  now() - make_interval(days => f.giorni_fa + 7)
from (values
  ('c0000000-0000-0000-0000-000000000001'::uuid, 60, 'active',    2500),
  ('c0000000-0000-0000-0000-000000000002'::uuid, 30, 'active',    2500),
  ('c0000000-0000-0000-0000-000000000001'::uuid, 14, 'cancelled', 2500)
) as f(field_id, giorni_fa, stato, prezzo);

-- e una futura, per vedere la divisione fra «prossime» e «passate»
insert into public.bookings
  (facility_id, field_id, member_id, slot, status, source, price_cents, cancel_deadline)
values (
  'f0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000003',
  (select id from public.members where phone = '3394128807'),
  tstzrange(((current_date + 5) + time '21:00') at time zone 'Europe/Rome',
            ((current_date + 5) + time '22:30') at time zone 'Europe/Rome'),
  'active', 'phone', 5700,
  ((current_date + 5) + time '21:00') at time zone 'Europe/Rome' - interval '24 hours'
);

select 'storico creato per Giulio Dante: ' || count(*)::text || ' prenotazioni'
from public.bookings b
join public.members m on m.id = b.member_id
where m.phone = '3394128807';

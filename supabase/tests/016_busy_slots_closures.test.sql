begin;
select plan(5);

-- `busy_slots` e' cio' che il cliente interroga per sapere quali orari sono
-- occupati. Guardava solo le prenotazioni: dopo una chiusura gli orari appena
-- liberati ricomparivano prenotabili, e il rifiuto arrivava solo a conferma
-- fatta (PS003). Qui si prova che la vista dice la stessa cosa che
-- `create_booking` gia' sapeva.

insert into public.facilities (id, slug, name, booking_horizon_days) values
  ('e3000000-0000-0000-0000-0000000000f1', 'test-busy-clo', 'Test Chiusure', 3650);
insert into public.fields (id, facility_id, name, kind) values
  ('e3000000-0000-0000-0000-0000000000d1','e3000000-0000-0000-0000-0000000000f1','Campo 1','calcio5'),
  ('e3000000-0000-0000-0000-0000000000d2','e3000000-0000-0000-0000-0000000000f1','Campo 2','calcio5');
insert into public.members (id, facility_id, name) values
  ('e3000000-0000-0000-0000-0000000000c1','e3000000-0000-0000-0000-0000000000f1','Cliente');

-- Una prenotazione gia' disdetta sul Campo 1, nella stessa fascia oraria della
-- chiusura: serve all'ultima asserzione, e verifica che l'unione non riporti
-- dentro cio' che il ramo delle prenotazioni escludeva.
insert into public.bookings (facility_id, field_id, member_id, slot, status, price_cents, cancel_deadline)
values ('e3000000-0000-0000-0000-0000000000f1','e3000000-0000-0000-0000-0000000000d1',
        'e3000000-0000-0000-0000-0000000000c1',
        tstzrange(now() + interval '9 days', now() + interval '9 days 1 hour'),
        'cancelled', 2500, now());

-- Chiusura su un campo solo.
insert into public.closures (id, facility_id, field_id, period) values
  ('e3000000-0000-0000-0000-0000000000a1','e3000000-0000-0000-0000-0000000000f1',
   'e3000000-0000-0000-0000-0000000000d1',
   tstzrange(now() + interval '2 days', now() + interval '2 days 3 hours'));

-- Le asserzioni girano come `anon`: la disponibilita' si guarda senza account,
-- ed e' esattamente la posizione da cui il difetto si vedeva.
set local role anon;

select isnt_empty(
  $$select 1 from public.busy_slots
     where field_id = 'e3000000-0000-0000-0000-0000000000d1'
       and slot && tstzrange(now() + interval '2 days', now() + interval '2 days 1 hour')$$,
  'un campo chiuso risulta occupato nel periodo della chiusura');

select is_empty(
  $$select 1 from public.busy_slots
     where field_id = 'e3000000-0000-0000-0000-0000000000d2'
       and slot && tstzrange(now() + interval '2 days', now() + interval '2 days 1 hour')$$,
  'la chiusura di un campo non occupa il campo accanto');

select is_empty(
  $$select 1 from public.busy_slots
     where field_id = 'e3000000-0000-0000-0000-0000000000d1'
       and slot && tstzrange(now() + interval '9 days', now() + interval '9 days 1 hour')$$,
  'una prenotazione disdetta continua a non occupare niente');

reset role;

-- Chiusura di tutta la struttura: `field_id` nullo vale per ogni campo.
insert into public.closures (id, facility_id, field_id, period) values
  ('e3000000-0000-0000-0000-0000000000a2','e3000000-0000-0000-0000-0000000000f1', null,
   tstzrange(now() + interval '5 days', now() + interval '5 days 6 hours'));

set local role anon;

select is(
  (select count(distinct field_id)::integer from public.busy_slots
    where facility_id = 'e3000000-0000-0000-0000-0000000000f1'
      and slot && tstzrange(now() + interval '5 days', now() + interval '5 days 1 hour')),
  2,
  'una chiusura senza campo occupa tutti i campi della struttura');

reset role;

-- Togliere la chiusura restituisce gli orari: la vista e' derivata, non c'e'
-- niente da sincronizzare. E' cio' che `ClosuresPage` promette al gestore.
delete from public.closures where id = 'e3000000-0000-0000-0000-0000000000a1';

set local role anon;

select is_empty(
  $$select 1 from public.busy_slots
     where field_id = 'e3000000-0000-0000-0000-0000000000d1'
       and slot && tstzrange(now() + interval '2 days', now() + interval '2 days 1 hour')$$,
  'cancellata la chiusura, gli orari tornano liberi da soli');

select * from finish();
rollback;

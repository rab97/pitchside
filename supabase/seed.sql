-- Dati con cui aprire l'app e vedere qualcosa fin dal primo avvio.
-- Girano a ogni `npm run db:reset`, mai in produzione.

insert into public.facilities (id, slug, name, color, phone, address)
values ('f0000000-0000-0000-0000-000000000001', 'palacalcetto', 'Palacalcetto',
        '#146B3F', '0173441290', 'Via dello Sport 14, Alba');

insert into public.facility_domains (facility_id, hostname) values
  ('f0000000-0000-0000-0000-000000000001', 'localhost'),
  ('f0000000-0000-0000-0000-000000000001', '127.0.0.1'),
  ('f0000000-0000-0000-0000-000000000001', 'prenota.palacalcetto.it');

insert into public.fields (id, facility_id, name, kind, covered, sort_order) values
  ('c0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','Campo 1','calcio5', true, 1),
  ('c0000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000001','Campo 2','calcio5', false, 2),
  ('c0000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000001','Campo 3','calcio7', false, 3);

insert into public.price_bands (facility_id, field_id, weekdays, starts_min, ends_min, price_cents)
select 'f0000000-0000-0000-0000-000000000001', f.id, w.days, w.s, w.e,
       case when f.kind = 'calcio7' then w.p + 1000 else w.p end
from public.fields f
cross join (values
  ('{1,2,3,4,5}'::smallint[], 900::smallint, 1140::smallint, 2000),
  ('{1,2,3,4,5}'::smallint[], 1140::smallint, 1440::smallint, 2500),
  ('{6,7}'::smallint[], 540::smallint, 1440::smallint, 2800)
) as w(days, s, e, p)
where f.facility_id = 'f0000000-0000-0000-0000-000000000001';

insert into public.members (facility_id, name, phone) values
  ('f0000000-0000-0000-0000-000000000001', 'Giulio Dante', '3394128807'),
  ('f0000000-0000-0000-0000-000000000001', 'Marco Ferrero', '3472201563'),
  ('f0000000-0000-0000-0000-000000000001', 'Amici del Martedì', '3401187721');

-- ---------------------------------------------------------------------------
-- Un amministratore con cui entrare in /admin durante lo sviluppo.
-- Numero +39 347 220 15 63, codice SMS 472839 (vedi [auth.sms.test_otp] in
-- config.toml). Vive solo nel database locale: la produzione registra i
-- gestori dall'app, non dal seed.
--
-- Il telefono va scritto senza il '+': gotrue normalizza cosi', e una riga
-- con il prefisso non verrebbe riconosciuta al login — creerebbe un secondo
-- utente, che non e' amministratore di niente.
-- ---------------------------------------------------------------------------
-- I campi *_token vanno a stringa vuota e non a NULL: gotrue li legge in
-- variabili Go non nullable e un NULL fa fallire ogni login con
-- "Database error finding user".
insert into auth.users (
  instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, last_sign_in_at
) values (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', '393472201563', now(),
  '', '', '', '',
  '{"provider":"phone","providers":["phone"]}'::jsonb,
  '{"name":"Gestore Palacalcetto"}'::jsonb,
  now(), now(), now()
);

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at,
  created_at, updated_at
) values (
  '393472201563',
  'a0000000-0000-0000-0000-000000000001',
  '{"sub":"a0000000-0000-0000-0000-000000000001","phone":"393472201563"}'::jsonb,
  'phone', now(), now(), now()
);

insert into public.facility_admins (facility_id, user_id, role) values
  ('f0000000-0000-0000-0000-000000000001',
   'a0000000-0000-0000-0000-000000000001', 'owner');

-- La stessa persona è anche un member della struttura: il gestore prenota
-- come chiunque altro, e la sua riga si aggancia all'account per telefono.
update public.members
   set user_id = 'a0000000-0000-0000-0000-000000000001'
 where facility_id = 'f0000000-0000-0000-0000-000000000001'
   and phone = '3472201563';

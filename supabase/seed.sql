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

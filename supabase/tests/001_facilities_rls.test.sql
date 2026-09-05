begin;
select plan(5);

select has_table('public', 'facilities', 'facilities esiste');
select has_table('public', 'fields', 'fields esiste');
select has_function('public', 'is_facility_admin', array['uuid'], 'is_facility_admin esiste');

-- RLS attiva
select is(relrowsecurity, true, 'RLS attiva su facilities')
  from pg_class where oid = 'public.facilities'::regclass;
select is(relrowsecurity, true, 'RLS attiva su fields')
  from pg_class where oid = 'public.fields'::regclass;

select * from finish();
rollback;

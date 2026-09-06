begin;
select plan(4);

select has_table('public', 'members', 'members esiste');
select col_is_null('public', 'members', 'user_id', 'user_id è nullable');

-- un membro senza account si può inserire
insert into public.facilities (id, slug, name)
  values ('11111111-1111-1111-1111-111111111111', 'test', 'Test');
select lives_ok(
  $$insert into public.members (facility_id, name, phone)
    values ('11111111-1111-1111-1111-111111111111', 'Rossi', '3472201563')$$,
  'un membro senza account si inserisce'
);

-- stesso telefono in due strutture: ammesso
insert into public.facilities (id, slug, name)
  values ('22222222-2222-2222-2222-222222222222', 'test2', 'Test 2');
select lives_ok(
  $$insert into public.members (facility_id, name, phone)
    values ('22222222-2222-2222-2222-222222222222', 'Rossi', '3472201563')$$,
  'lo stesso telefono esiste in due strutture'
);

select * from finish();
rollback;

begin;
select plan(3);

select has_view('public', 'busy_slots', 'la vista busy_slots esiste');

-- la vista non deve esporre nomi né importi
select hasnt_column('public', 'busy_slots', 'member_id',
  'busy_slots non espone member_id');
select hasnt_column('public', 'busy_slots', 'price_cents',
  'busy_slots non espone il prezzo');

select * from finish();
rollback;

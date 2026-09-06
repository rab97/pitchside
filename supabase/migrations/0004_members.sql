create table public.members (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  -- nullable per scelta: copre chi telefona e chi viene aggiunto da un capitano
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  phone text,
  email text,
  kind text not null default 'person' check (kind in ('person', 'group', 'team')),
  price_list text not null default 'standard',
  notes text,                       -- note interne: mai esposte al cliente
  honored_count integer not null default 0,
  missed_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Un telefono e' unico dentro una struttura, non nel sistema:
-- la stessa persona puo' essere cliente di due impianti.
create unique index members_facility_phone_uniq
  on public.members (facility_id, phone) where phone is not null;
create unique index members_facility_user_uniq
  on public.members (facility_id, user_id) where user_id is not null;
create index members_name_idx on public.members (facility_id, lower(name));

-- Affidabilita': percentuale di prenotazioni onorate. NULL finche' non c'e'
-- storia, perche' "0%" per un cliente nuovo sarebbe una calunnia.
create or replace function public.member_reliability(m public.members)
returns integer
language sql
stable
as $$
  select case
    when m.honored_count + m.missed_count = 0 then null
    else round(100.0 * m.honored_count / (m.honored_count + m.missed_count))::integer
  end;
$$;

-- Cerca le schede associate a un numero, in ogni struttura.
-- Serve alla rivendicazione dopo la registrazione: il chiamante e' l'utente
-- appena autenticato, quindi SECURITY DEFINER ma con filtro sul telefono.
create or replace function public.find_members_by_phone(p_phone text)
returns setof public.members
language sql
stable
security definer
set search_path = public
as $$
  select * from public.members
  where phone = p_phone and user_id is null;
$$;

alter table public.members enable row level security;

create policy members_read_own on public.members
  for select using (user_id = auth.uid());
create policy members_read_admin on public.members
  for select using (public.is_facility_admin(facility_id));
create policy members_write_admin on public.members
  for all using (public.is_facility_admin(facility_id))
  with check (public.is_facility_admin(facility_id));

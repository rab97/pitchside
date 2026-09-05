create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  color text not null default '#146B3F',
  phone text,
  address text,
  -- regole di prenotazione
  cancel_hours smallint not null default 24 check (cancel_hours >= 0),
  booking_horizon_days smallint not null default 60 check (booking_horizon_days > 0),
  slot_minutes smallint not null default 30 check (slot_minutes in (15, 30, 60)),
  min_duration_minutes smallint not null default 60 check (min_duration_minutes > 0),
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.facility_domains (
  facility_id uuid not null references public.facilities(id) on delete cascade,
  hostname text primary key
);

create table public.facility_admins (
  facility_id uuid not null references public.facilities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  primary key (facility_id, user_id)
);

-- Usata da tutte le policy. SECURITY DEFINER perche' deve leggere
-- facility_admins anche quando la policy che la chiama non lo permetterebbe:
-- senza, la policy ricorrerebbe su se' stessa.
create or replace function public.is_facility_admin(p_facility uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.facility_admins fa
    where fa.facility_id = p_facility
      and fa.user_id = auth.uid()
  );
$$;

alter table public.facilities enable row level security;
alter table public.facility_domains enable row level security;
alter table public.facility_admins enable row level security;

-- La scheda della struttura e' pubblica: la home la mostra senza login.
create policy facilities_read_all on public.facilities
  for select using (true);
create policy facilities_write_admin on public.facilities
  for update using (public.is_facility_admin(id))
  with check (public.is_facility_admin(id));

create policy domains_read_all on public.facility_domains
  for select using (true);

create policy admins_read_self on public.facility_admins
  for select using (user_id = auth.uid());

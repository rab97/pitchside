create table public.fields (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('calcio5', 'calcio7', 'calcio11')),
  surface text not null default 'sintetico',
  covered boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0
);

create index fields_facility_idx on public.fields (facility_id, sort_order);

alter table public.fields enable row level security;

create policy fields_read_all on public.fields
  for select using (true);
create policy fields_write_admin on public.fields
  for all using (public.is_facility_admin(facility_id))
  with check (public.is_facility_admin(facility_id));

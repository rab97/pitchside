create table public.closures (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  field_id uuid references public.fields(id) on delete cascade,  -- null = tutti i campi
  period tstzrange not null,
  reason text
);
create index closures_facility_idx on public.closures using gist (facility_id, period);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  slot tstzrange not null,
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'no_show')),
  source text not null default 'app'
    check (source in ('phone', 'app', 'admin', 'tournament', 'recurrence')),
  price_cents integer not null,
  cancel_deadline timestamptz not null,
  recurrence_id uuid,               -- FK aggiunta nel Task 13
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancel_reason text
);

create index bookings_day_idx on public.bookings (facility_id, field_id, slot);
create index bookings_member_idx on public.bookings (member_id, slot);

-- IL vincolo. Due prenotazioni attive non possono sovrapporsi sullo stesso
-- campo, nemmeno se inserite nello stesso millisecondo da due sessioni diverse.
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (field_id with =, slot with &&)
  where (status = 'active');

alter table public.bookings enable row level security;
alter table public.closures enable row level security;

create policy bookings_read_own on public.bookings
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
  );
create policy bookings_read_admin on public.bookings
  for select using (public.is_facility_admin(facility_id));
-- Nessuna policy di INSERT o UPDATE: si passa solo dalle RPC.
-- L'assenza e' deliberata: rende la regola un fatto del database, non una
-- convenzione che qualcuno dimentichera'.

create policy closures_read_all on public.closures
  for select using (true);
create policy closures_write_admin on public.closures
  for all using (public.is_facility_admin(facility_id))
  with check (public.is_facility_admin(facility_id));

create or replace function public.create_booking(
  p_field_id uuid,
  p_slot tstzrange,
  p_member_id uuid,
  p_source text default 'app'
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  f public.fields;
  fac public.facilities;
  v_price integer;
  v_row public.bookings;
begin
  select * into f from public.fields where id = p_field_id and active;
  if not found then
    raise exception 'Il campo non è disponibile.' using errcode = 'P0002';
  end if;

  select * into fac from public.facilities where id = f.facility_id;

  if lower(p_slot) < now() then
    raise exception 'Non si può prenotare nel passato.' using errcode = 'P0006';
  end if;

  if lower(p_slot) > now() + make_interval(days => fac.booking_horizon_days) then
    raise exception 'Si può prenotare al massimo % giorni in anticipo.',
      fac.booking_horizon_days using errcode = 'P0007';
  end if;

  if extract(epoch from (upper(p_slot) - lower(p_slot))) / 60
     < fac.min_duration_minutes then
    raise exception 'La durata minima è di % minuti.',
      fac.min_duration_minutes using errcode = 'P0008';
  end if;

  if exists (
    select 1 from public.closures c
    where c.facility_id = fac.id
      and (c.field_id is null or c.field_id = p_field_id)
      and c.period && p_slot
  ) then
    raise exception 'Il campo è chiuso in quell''orario.' using errcode = 'P0003';
  end if;

  -- Alza P0005 se lo slot cade fuori dall'orario di apertura.
  v_price := public.calc_booking_price(p_field_id, p_slot);

  insert into public.bookings (
    facility_id, field_id, member_id, slot, status, source,
    price_cents, cancel_deadline, created_by
  ) values (
    fac.id, p_field_id, p_member_id, p_slot, 'active', p_source,
    v_price, lower(p_slot) - make_interval(hours => fac.cancel_hours), auth.uid()
  ) returning * into v_row;

  return v_row;
exception
  when exclusion_violation then
    raise exception 'Questo slot è già stato prenotato.' using errcode = 'P0004';
end;
$$;

create or replace function public.cancel_booking(
  p_booking_id uuid,
  p_reason text default null
) returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.bookings;
  v_late boolean;
begin
  select * into v_row from public.bookings where id = p_booking_id for update;
  if not found then
    raise exception 'Prenotazione non trovata.' using errcode = 'P0009';
  end if;
  if v_row.status <> 'active' then
    raise exception 'La prenotazione è già stata disdetta.' using errcode = 'P0010';
  end if;

  v_late := now() > v_row.cancel_deadline;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = p_reason
   where id = p_booking_id
   returning * into v_row;

  -- L'affidabilità si muove solo sulle disdette tardive.
  if v_late then
    update public.members set missed_count = missed_count + 1
     where id = v_row.member_id;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.create_booking(uuid, tstzrange, uuid, text) from public;
revoke execute on function public.cancel_booking(uuid, text) from public;
grant execute on function public.create_booking(uuid, tstzrange, uuid, text) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;

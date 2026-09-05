create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  weekday smallint not null check (weekday between 1 and 7),  -- ISO: 1 = lunedì
  start_min smallint not null check (start_min >= 0 and start_min < 1440),
  duration_minutes smallint not null check (duration_minutes > 0),
  from_date date not null,
  to_date date not null,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);

alter table public.bookings
  add constraint bookings_recurrence_fk
  foreign key (recurrence_id) references public.recurrences(id) on delete set null;

-- Le occorrenze sono prenotazioni vere, generate una volta: non una regola
-- valutata a runtime. Solo così ognuna è cancellabile e spostabile da sola.
create or replace function public.generate_recurrence(p_recurrence_id uuid)
returns table (created integer, skipped integer, skipped_dates date[])
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.recurrences;
  d date;
  tz constant text := 'Europe/Rome';
  v_slot tstzrange;
  v_booking public.bookings;
  n_created integer := 0;
  n_skipped integer := 0;
  skipped date[] := '{}';
begin
  select * into r from public.recurrences where id = p_recurrence_id;
  if not found then
    raise exception 'Ricorrenza non trovata.' using errcode = 'PS011';
  end if;

  for d in
    select gs::date from generate_series(r.from_date, r.to_date, interval '1 day') gs
    where extract(isodow from gs) = r.weekday
  loop
    v_slot := tstzrange(
      (d + make_interval(mins => r.start_min)) at time zone tz,
      (d + make_interval(mins => r.start_min + r.duration_minutes)) at time zone tz,
      '[)'
    );
    begin
      -- La variabile si chiama v_slot e non slot: `slot = slot` avrebbe
      -- confrontato la colonna con sé stessa, marcando come ricorrenti
      -- tutte le prenotazioni attive del campo.
      v_booking := public.create_booking(r.field_id, v_slot, r.member_id, 'recurrence');
      update public.bookings set recurrence_id = r.id where id = v_booking.id;
      n_created := n_created + 1;
    exception when others then
      -- Una data occupata non ferma la generazione: si salta e si segnala.
      n_skipped := n_skipped + 1;
      skipped := skipped || d;
    end;
  end loop;

  return query select n_created, n_skipped, skipped;
end;
$$;

alter table public.recurrences enable row level security;

create policy recurrences_read_admin on public.recurrences
  for select using (public.is_facility_admin(facility_id));
create policy recurrences_write_admin on public.recurrences
  for all using (public.is_facility_admin(facility_id))
  with check (public.is_facility_admin(facility_id));

grant execute on function public.generate_recurrence(uuid) to authenticated;

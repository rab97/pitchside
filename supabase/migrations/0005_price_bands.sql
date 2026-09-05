-- Gli orari sono minuti da mezzanotte (0..1440) e non `time`:
-- la chiusura a mezzanotte e' il caso normale e `time '24:00'` non esiste.
create table public.price_bands (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete cascade,
  weekdays smallint[] not null check (
    array_length(weekdays, 1) between 1 and 7
    and weekdays <@ array[1,2,3,4,5,6,7]::smallint[]
  ),
  starts_min smallint not null check (starts_min >= 0 and starts_min < 1440),
  ends_min   smallint not null check (ends_min > 0 and ends_min <= 1440),
  price_cents integer not null check (price_cents >= 0),
  check (ends_min > starts_min)
);

create index price_bands_field_idx on public.price_bands (field_id);

-- Prezzo di uno slot, sommando i minuti che cadono in ciascuna fascia.
-- L'assenza di fascia significa "fuori orario di apertura": le fasce, per
-- vincolo di prodotto, coprono tutto l'orario in cui si puo' prenotare.
create or replace function public.calc_booking_price(
  p_field_id uuid,
  p_slot tstzrange
) returns integer
language plpgsql
stable
set search_path = public
as $$
declare
  tz constant text := 'Europe/Rome';
  total numeric := 0;
  cur timestamptz;
  fin timestamptz;
  loc timestamp;
  dow smallint;
  cur_min integer;
  b public.price_bands;
  seg_end timestamptz;
  guard integer := 0;
begin
  cur := lower(p_slot);
  fin := upper(p_slot);
  if cur is null or fin is null or cur >= fin then
    raise exception 'intervallo non valido' using errcode = 'P0001';
  end if;

  while cur < fin loop
    guard := guard + 1;
    if guard > 100 then
      raise exception 'calcolo prezzo non terminato: fasce incoerenti'
        using errcode = 'P0001';
    end if;

    loc := cur at time zone tz;
    dow := extract(isodow from loc)::smallint;
    cur_min := extract(hour from loc)::int * 60 + extract(minute from loc)::int;

    select * into b from public.price_bands pb
     where pb.field_id = p_field_id
       and dow = any(pb.weekdays)
       and cur_min >= pb.starts_min
       and cur_min <  pb.ends_min
     limit 1;

    if not found then
      raise exception 'nessuna tariffa attiva per le % del %',
        to_char(loc, 'HH24:MI'), to_char(loc, 'DD/MM/YYYY')
        using errcode = 'P0005';
    end if;

    seg_end := least(
      fin,
      (date_trunc('day', loc) + make_interval(mins => b.ends_min)) at time zone tz
    );

    total := total + b.price_cents
             * (extract(epoch from (seg_end - cur)) / 3600.0);
    cur := seg_end;
  end loop;

  return round(total)::integer;
end;
$$;

alter table public.price_bands enable row level security;

create policy price_bands_read_all on public.price_bands
  for select using (true);
create policy price_bands_write_admin on public.price_bands
  for all using (public.is_facility_admin(facility_id))
  with check (public.is_facility_admin(facility_id));

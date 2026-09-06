-- L'utente corrente è il titolare di quella scheda cliente?
-- SECURITY DEFINER perché deve leggere members anche quando la RLS del
-- chiamante non gliela mostrerebbe: la domanda è «è mia?», non «fammela vedere».
create or replace function public.owns_member(p_member_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.members m
    where m.id = p_member_id and m.user_id = auth.uid()
  );
$$;

-- PS012 non autenticato · PS013 sta agendo per conto di un altro
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
  v_admin boolean;
  v_source text := p_source;
begin
  select * into f from public.fields where id = p_field_id and active;
  if not found then
    raise exception 'Il campo non è disponibile.' using errcode = 'PS002';
  end if;

  select * into fac from public.facilities where id = f.facility_id;

  -- Autorizzazione. Il gestore prende le telefonate per conto di chiunque;
  -- un cliente agisce solo per sé, e non può nemmeno scegliere l'origine:
  -- altrimenti una prenotazione dall'app si travestirebbe da telefonata.
  v_admin := public.is_facility_admin(fac.id);
  if not v_admin then
    if auth.uid() is null then
      raise exception 'Devi accedere per prenotare.' using errcode = 'PS012';
    end if;
    if not public.owns_member(p_member_id) then
      raise exception 'Non puoi prenotare a nome di un altro.' using errcode = 'PS013';
    end if;
    v_source := 'app';
  end if;

  if lower(p_slot) < now() then
    raise exception 'Non si può prenotare nel passato.' using errcode = 'PS006';
  end if;

  if v_source = 'app'
     and lower(p_slot) > now() + make_interval(days => fac.booking_horizon_days) then
    raise exception 'Si può prenotare al massimo % giorni in anticipo.',
      fac.booking_horizon_days using errcode = 'PS007';
  end if;

  if extract(epoch from (upper(p_slot) - lower(p_slot))) / 60
     < fac.min_duration_minutes then
    raise exception 'La durata minima è di % minuti.',
      fac.min_duration_minutes using errcode = 'PS008';
  end if;

  if exists (
    select 1 from public.closures c
    where c.facility_id = fac.id
      and (c.field_id is null or c.field_id = p_field_id)
      and c.period && p_slot
  ) then
    raise exception 'Il campo è chiuso in quell''orario.' using errcode = 'PS003';
  end if;

  v_price := public.calc_booking_price(p_field_id, p_slot);

  insert into public.bookings (
    facility_id, field_id, member_id, slot, status, source,
    price_cents, cancel_deadline, created_by
  ) values (
    fac.id, p_field_id, p_member_id, p_slot, 'active', v_source,
    v_price, lower(p_slot) - make_interval(hours => fac.cancel_hours), auth.uid()
  ) returning * into v_row;

  return v_row;
exception
  when exclusion_violation then
    raise exception 'Questo slot è già stato prenotato.' using errcode = 'PS004';
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
    raise exception 'Prenotazione non trovata.' using errcode = 'PS009';
  end if;

  -- Autorizzazione prima di ogni altra cosa, e prima di restituire alcunché:
  -- fino a oggi la funzione rispondeva con la riga intera a chiunque la
  -- chiedesse, scavalcando la RLS che gliel'aveva appena negata.
  if not public.is_facility_admin(v_row.facility_id)
     and not public.owns_member(v_row.member_id) then
    if auth.uid() is null then
      raise exception 'Devi accedere.' using errcode = 'PS012';
    end if;
    raise exception 'Non puoi disdire la prenotazione di un altro.'
      using errcode = 'PS013';
  end if;

  if v_row.status <> 'active' then
    raise exception 'La prenotazione è già stata disdetta.' using errcode = 'PS010';
  end if;

  v_late := now() > v_row.cancel_deadline;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = p_reason
   where id = p_booking_id
   returning * into v_row;

  if v_late then
    update public.members set missed_count = missed_count + 1
     where id = v_row.member_id;
  end if;

  return v_row;
end;
$$;

grant execute on function public.owns_member(uuid) to authenticated;

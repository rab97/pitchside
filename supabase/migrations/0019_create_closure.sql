-- Closing is an event, not a form submission: when there are already bookings
-- within the period, you either close and cancel together or do nothing.
-- Leaving them active would send a customer to a closed gate with a booking
-- in hand that the system calls valid.
--
-- Therefore a function, not two writes from the client: `bookings` is
-- writable only by RPC, and both writes must be in one transaction.
--
--   PS016 caller does not administer this facility
--
-- The conflict preview, however, remains a normal `select` from the panel:
-- the manager can already read their own bookings via RLS, and only the
-- write needs privileges.
create or replace function public.create_closure(
  p_facility_id uuid,
  p_field_id uuid,      -- null = whole facility
  p_period tstzrange,
  p_reason text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cancelled integer;
begin
  -- Authorize before acting. `security definer` executes, period: if the
  -- check is not here, it does not exist.
  if not public.is_facility_admin(p_facility_id) then
    raise exception 'Non puoi modificare questa struttura.' using errcode = 'PS016';
  end if;

  if p_period is null or isempty(p_period) then
    raise exception 'Periodo non valido.' using errcode = 'PS001';
  end if;

  -- A field from another facility does not get closed from here, not even by mistake.
  if p_field_id is not null and not exists (
    select 1 from public.fields f
     where f.id = p_field_id and f.facility_id = p_facility_id
  ) then
    raise exception 'Campo non trovato.' using errcode = 'PS002';
  end if;

  insert into public.closures (facility_id, field_id, period, reason)
  values (p_facility_id, p_field_id, p_period, nullif(btrim(p_reason), ''));

  -- We write `cancelled` directly instead of calling `cancel_booking`:
  -- that function increments `missed_count` beyond the deadline, which is
  -- correct when the player pulls out and wrong when the manager closes.
  -- Here we touch no counters.
  with hit as (
    update public.bookings b
       set status = 'cancelled'
     where b.facility_id = p_facility_id
       and b.status = 'active'
       and b.slot && p_period
       and (p_field_id is null or b.field_id = p_field_id)
    returning 1
  )
  select count(*)::integer into v_cancelled from hit;

  return v_cancelled;
end;
$$;

revoke all on function public.create_closure(uuid, uuid, tstzrange, text) from public;
grant execute on function public.create_closure(uuid, uuid, tstzrange, text) to authenticated;

-- Il cliente deve vedere quali slot sono occupati senza sapere da chi.
-- La vista gira come proprietario (security_invoker off) e per questo scavalca
-- la RLS di bookings: e' sicuro perche' espone solo campo e intervallo.
create view public.busy_slots
with (security_invoker = off) as
  select b.facility_id, b.field_id, b.slot
  from public.bookings b
  where b.status = 'active';

grant select on public.busy_slots to anon, authenticated;

-- `busy_slots` is what the customer's page asks to find out which hours are
-- taken. It read only `bookings`, so it did not know closures existed.
--
-- That gap opened the day closures shipped. A manager closes a pitch for a
-- repair, `create_closure` cancels the bookings in the way, and those hours
-- reappear on `/prenota` as free. The customer picks one, fills the form, and
-- is refused only at confirm time, by `create_booking`'s PS003 — which knew all
-- along. The database was right and the view was lying.
--
-- Nothing new is decided here: the rule already exists in `create_booking`
-- (`0011_rpc_authorization.sql:74`). This makes the view say the same thing, so
-- the refusal arrives before the customer has typed anything rather than after.
--
-- A closure with a null `field_id` covers every pitch of the facility, so the
-- join fans it out; a closure naming a pitch matches that one. Removing a
-- closure frees the hours again with nothing to synchronise, because the view
-- is derived — which is what `ClosuresPage` already promises the manager.
--
-- The column list is unchanged, so every consumer keeps working untouched:
-- `useAvailability` filters by facility, field and overlap, and the new branch
-- answers those filters exactly as the old one does.
create or replace view public.busy_slots
with (security_invoker = off) as
  select b.facility_id, b.field_id, b.slot
    from public.bookings b
   where b.status = 'active'
  union all
  select c.facility_id, f.id, c.period
    from public.closures c
    join public.fields f
      on f.facility_id = c.facility_id
     and (c.field_id is null or f.id = c.field_id);

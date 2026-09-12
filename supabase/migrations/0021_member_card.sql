-- Recognising the caller, part 2: the card.
--
-- Appearances are counted here from `bookings` rather than read from
-- `members.honored_count`, because nothing in this project ever increments
-- that column — searched across every migration and every source file, only
-- test fixtures set it. Feeding `member_reliability` with it yields exactly two
-- values in production: null when there are no misses, and 0% as soon as there
-- is one. A customer with fifty appearances and one no-show would read 0%, and
-- the manager would treat their best customer worst.
--
-- A booking that is `active` with a slot already past is an appearance: nobody
-- marked it `no_show`. That is derivable today, with no new writes and no
-- backfill.
--
-- Not SECURITY DEFINER, deliberately, same reasoning as `search_members`: RLS
-- on `members` already admits exactly the facility admin, so a caller who does
-- not administer this member's facility joins against zero rows and gets zero
-- rows back, notes included.

create or replace function public.member_card(p_member_id uuid)
returns table (
  id uuid,
  name text,
  phone text,
  email text,
  price_list text,
  notes text,
  appearances integer,
  missed integer,
  last_played timestamptz,
  usual_field_name text
)
language sql
stable
as $$
  select
    m.id,
    m.name,
    m.phone,
    m.email,
    m.price_list,
    m.notes,
    coalesce((
      select count(*)
        from public.bookings b
       where b.member_id = m.id
         and b.status = 'active'
         and upper(b.slot) < now()
    ), 0)::integer as appearances,
    m.missed_count as missed,
    (select max(upper(b.slot))
       from public.bookings b
      where b.member_id = m.id
        and b.status = 'active'
        and upper(b.slot) < now()) as last_played,
    (select f.name
       from public.bookings b
       join public.fields f on f.id = b.field_id
      where b.member_id = m.id
        and b.status = 'active'
        and upper(b.slot) < now()
      group by f.id, f.name
      -- Ties broken by name so the sentence the manager reads does not change
      -- between two refreshes for a customer who splits evenly between pitches.
      order by count(*) desc, f.name
      limit 1) as usual_field_name
  from public.members m
 where m.id = p_member_id;
$$;

revoke all on function public.member_card(uuid) from public;
grant execute on function public.member_card(uuid) to authenticated;

-- Recognising the caller, part 1: the search.
--
-- The ordering is the feature. If the right customer is not the first row the
-- manager picks the wrong person while someone is talking to them, so the rule
-- lives here where pgTAP can pin it, instead of in a PostgREST filter string
-- assembled in the browser.

create extension if not exists unaccent with schema extensions;

-- `unaccent(text)` is only STABLE: it reads whichever dictionary the session
-- points at. The two-argument form with an explicit dictionary is IMMUTABLE,
-- which is what lets this be indexed the day the member table outgrows a scan.
create or replace function public.name_key(p_name text)
returns text
language sql
immutable
as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(p_name, '')));
$$;

-- Not SECURITY DEFINER, deliberately: RLS stays in force under the caller's own
-- role, and a definer function would have to re-implement the tenant check —
-- the second copy being the one that drifts.
--
-- Do not read that as "only a facility admin can call this". `members` carries
-- two SELECT policies, OR'd together: `members_read_admin` and
-- `members_read_own` (0004_members.sql:54-57, and see 0021_member_card.sql:18-27
-- for what that costs there). A customer who has claimed their own row reaches
-- this function and gets that row back.
--
-- Which is safe for the five columns below, and safe *only* because of them: an
-- id, a name, a phone and a missed-booking flag that are the caller's own.
-- Widening this return table is therefore not a free change. `notes`,
-- `price_list` or anything else the manager alone should read would be handed
-- to the very customer it is written about — the same leak `member_card` had to
-- carry its own `is_facility_admin` predicate to close. A `search_members` that
-- ever has to return such a column needs that predicate too.
--
-- §1 of the spec invites a future registry page to reuse this function, so that
-- day will come. `014_member_search.test.sql` asserts both halves — the claimed
-- member reaching this function, and the exact list of columns it returns — so
-- whoever widens it trips a test instead of a customer.
create or replace function public.search_members(p_facility uuid, p_query text)
returns table (id uuid, name text, phone text, has_missed boolean, rank smallint)
language sql
stable
as $$
  with q as (
    select
      public.name_key(btrim(coalesce(p_query, ''))) as name_q,
      -- The typed digits, normalised by the very function the other side of
      -- every comparison below is keyed by. This used to be its own
      -- `regexp_replace`, which produced *all* the digits typed while
      -- `phone_key(m.phone)` is the last ten — so «+39 333 111 2233» compared
      -- twelve digits against ten and found nobody. That is the number the
      -- manager actually has in front of them, because it is how caller ID
      -- writes one on an Italian phone: the feature's headline case missed.
      --
      -- `phone_key` rather than a second `right(…, 10)` here on purpose. It is
      -- already this project's answer to "which digits identify a number", it
      -- is what the unique index is built over (0016_member_adoption.sql:31),
      -- and one definition cannot drift from itself. It also does the
      -- digits-only pass itself, so this is one call where there were two
      -- rules.
      --
      -- Below ten digits it changes nothing — `right(s, 10)` of a shorter
      -- string is that string — so a partial number still narrows as the
      -- manager reads digits aloud, and the `length(…) >= 3` guard below still
      -- counts the digits they actually typed.
      public.phone_key(p_query) as digits
  ),
  scored as (
    select
      m.id,
      m.name,
      m.phone,
      m.missed_count > 0 as has_missed,
      (case
         -- Both sides are `phone_key` now, so these compare the same kind of
         -- thing: a whole number typed any way round lands on rank 1, and a
         -- partial one is matched as a prefix of the key — never as a fragment
         -- from the middle, because a manager reading a caller ID has the start
         -- of a number and a mid-string match would scan for a case nobody has.
         when q.digits is not null and length(q.digits) >= 3
              and public.phone_key(m.phone) = q.digits              then 1
         when q.digits is not null and length(q.digits) >= 3
              and public.phone_key(m.phone) like q.digits || '%'     then 2
         when public.name_key(m.name) like q.name_q || '%'           then 3
         when public.name_key(m.name) like '%' || q.name_q || '%'    then 4
       end)::smallint as rank,
      -- Whoever is calling is more likely a regular than someone who vanished
      -- two years ago, so recency breaks ties. Cancelled bookings do not count
      -- as having played.
      (select max(upper(b.slot))
         from public.bookings b
        where b.member_id = m.id
          and b.status <> 'cancelled') as last_played
    from public.members m
    cross join q
    where m.facility_id = p_facility
      and length(q.name_q) >= 2
  )
  select s.id, s.name, s.phone, s.has_missed, s.rank
    from scored s
   where s.rank is not null
   order by s.rank, s.last_played desc nulls last, s.name
   limit 8;
$$;

revoke all on function public.search_members(uuid, text) from public;
grant execute on function public.search_members(uuid, text) to authenticated;

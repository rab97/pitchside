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

-- Not SECURITY DEFINER, deliberately. RLS on `members` already admits exactly
-- the facility admin, and on `bookings` the same; a definer function would have
-- to re-implement that check, and the second copy is the one that drifts.
create or replace function public.search_members(p_facility uuid, p_query text)
returns table (id uuid, name text, phone text, has_missed boolean, rank smallint)
language sql
stable
as $$
  with q as (
    select
      public.name_key(btrim(coalesce(p_query, ''))) as name_q,
      nullif(regexp_replace(coalesce(p_query, ''), '\D', '', 'g'), '') as digits
  ),
  scored as (
    select
      m.id,
      m.name,
      m.phone,
      m.missed_count > 0 as has_missed,
      (case
         -- Digits are matched as a prefix of `phone_key`, never as a fragment
         -- from the middle: a manager reading a caller ID has the start of a
         -- number, and a mid-string match would scan for a case nobody has.
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

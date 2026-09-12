# Recognising the caller — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Inside «Nuova prenotazione», turn the name field into a real search over the facility's members and show the chosen person's card — appearances, misses, price list, what they usually book, and the internal notes — so the manager knows who is on the phone before the booking is made.

**Architecture:** Two `stable` SQL functions carry the domain logic: `search_members` runs on every keystroke and returns eight ranked, light rows; `member_card` runs once per selection and can afford aggregates. Neither is `security definer` — the existing RLS on `members` and `bookings` already confines a manager to their own facility, and a definer function would have to re-implement that check. On the client, three hooks wrap those calls, two presentational components render them, and `NewBookingDialog` loses the heuristic that currently guesses which member a booking belongs to.

**Tech Stack:** Postgres 17 + pgTAP · React 19 · TypeScript · TanStack Query v5 · Tailwind 4 · Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-09-12-member-lookup-design.md`

## Global Constraints

- **English in the repository** — commit messages, code comments, documentation, branch names. **Italian for every string a user reads** and for pgTAP test descriptions (all thirteen existing files are Italian; one English file would be the odd one out).
- **`npx tsc --noEmit` checks nothing in this repo** — the root tsconfig has `"files": []`. The real typecheck is **`npx tsc -b`**.
- The root tsconfig sets `erasableSyntaxOnly`: TypeScript parameter properties are forbidden.
- **Every mutation must prove it wrote.** A write excluded by an RLS `using` clause matches zero rows and returns no error, so each mutation asks for the affected row back and treats an empty result as a failure.
- **Queries live in `hooks/`**, one hook per file, named `use…`. They never live in components.
- Imports use `@/…` when crossing a feature boundary or reaching `shared/`; relative paths only within the same folder.
- Money in cents, times in minutes from midnight, every instant `timestamptz`, reference zone `Europe/Rome` from `src/shared/lib/tz.ts`.
- Form controls use the `.field` class from `src/index.css` — it owns height, radius, border, background and padding so stacked inputs align by construction.
- Touch targets that a finger is meant to hit are **44×44** under `pointer-coarse:`, as `AdminPage.tsx` and `MonthGridPopover.tsx` already do.
- Never `git push`, never open a PR. Never `pkill` on a pattern; terminate only an exact PID whose `/proc/<pid>/cwd` you verified. Never `docker … prune`; stop Supabase only with `npm run db:stop`.

---

## Task 0: Gina Workflow

- [ ] **Step 1: Ask whether to finalize the Claude plan**

Use `AskUserQuestion` with header **"Gina Workflow - Finalize Claude Plan"**, asking whether the user wants to run `/gina:finalize-claude-plan`.

Options: **"Yes, run /gina:finalize-claude-plan"** | **"Skip"**.

If Yes: execute the command. If Skip: continue with the remaining tasks.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0020_member_search.sql` | `unaccent`, `name_key`, `search_members` |
| `supabase/tests/014_member_search.test.sql` | ranking, accents, tenant isolation |
| `supabase/migrations/0021_member_card.sql` | `member_card` |
| `supabase/tests/015_member_card.test.sql` | aggregates, including a member with no history |
| `src/features/admin/hooks/useMemberSearch.ts` | the keystroke query |
| `src/features/admin/hooks/useMemberCard.ts` | the card, once per selection |
| `src/features/admin/hooks/useUpdateMemberNotes.ts` | the one write on an existing member |
| `src/features/admin/hooks/useCreateMember.ts` | the deliberate creation |
| `src/features/admin/utils/memberMessages.ts` | SQLSTATE → Italian sentence |
| `src/features/admin/components/MemberCard.tsx` | what the manager reads while talking |
| `src/features/admin/components/MemberSearchField.tsx` | the field, its results, the "new customer" gesture |
| `src/features/admin/components/NewBookingDialog.tsx` | **modified**: the heuristic is deleted |
| `src/features/admin/utils/pickMember.ts` + its test | **deleted** |

`MemberCard` is presentational and fetches nothing: it takes the card and an `onNotesBlur` callback. That is what lets Task 6 test every rendering rule — new customer, no misses, non-standard price list — without a database.

---

## Task 1: `search_members`, and the ranking that decides who the manager picks

**Files:**
- Create: `supabase/migrations/0020_member_search.sql`
- Create: `supabase/tests/014_member_search.test.sql`

**Interfaces:**
- Consumes: `public.phone_key(text)` from `0012_member_identity.sql` — keeps the last ten digits, `immutable`.
- Produces:
  - `public.name_key(p_name text) returns text` — lowercase, accents stripped.
  - `public.search_members(p_facility uuid, p_query text) returns table (id uuid, name text, phone text, has_missed boolean, rank smallint)` — at most 8 rows, already ordered. `rank` is 1 exact phone, 2 phone prefix, 3 name prefix, 4 name contains.

- [ ] **Step 1: Confirm where `unaccent` installs, and that the immutable two-argument form works**

The single-argument `unaccent(text)` is `stable`, because it reads whichever dictionary the session points at. The two-argument `unaccent(regdictionary, text)` is `immutable`. `name_key` must be `immutable` to stay usable in an index later, so it has to call the two-argument form with an explicit dictionary — and the dictionary's schema-qualified name depends on where Supabase put the extension.

Run:

```bash
npm run db:start
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c \
  "create extension if not exists unaccent with schema extensions;" -c \
  "select extensions.unaccent('extensions.unaccent'::regdictionary, 'Nicolò Sağlam');"
```

Expected: `Nicolo Saglam`.

If the `extensions` schema does not exist on this stack, install into `public` instead (`with schema public`) and use `'public.unaccent'::regdictionary` everywhere below. Write down which one you used — the migration and every later reference must agree.

- [ ] **Step 2: Write the failing pgTAP test**

Create `supabase/tests/014_member_search.test.sql`:

```sql
begin;
select plan(9);

insert into public.facilities (id, slug, name, booking_horizon_days) values
  ('e1000000-0000-0000-0000-0000000000f1', 'test-search-a', 'Struttura A', 3650),
  ('e1000000-0000-0000-0000-0000000000f2', 'test-search-b', 'Struttura B', 3650);
insert into public.fields (id, facility_id, name, kind) values
  ('e1000000-0000-0000-0000-0000000000fd','e1000000-0000-0000-0000-0000000000f1','Campo 1','calcio5');

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','e1000000-0000-0000-0000-0000000000ua',
   'authenticated','authenticated','390000000201', now(), '','','','', now(), now());
insert into public.facility_admins (facility_id, user_id)
  values ('e1000000-0000-0000-0000-0000000000f1','e1000000-0000-0000-0000-0000000000ua');

-- Rossi ha il numero esatto; Rossini comincia con le stesse cifre; Nicolò
-- serve agli accenti; De Rossi contiene «rossi» ma non ci comincia; Marco sta
-- nell'altra struttura con lo stesso numero di Rossi, e non deve mai uscire.
insert into public.members (id, facility_id, name, phone, missed_count) values
  ('e1000000-0000-0000-0000-0000000000m1','e1000000-0000-0000-0000-0000000000f1','Rossi Luca','3331112233', 0),
  ('e1000000-0000-0000-0000-0000000000m2','e1000000-0000-0000-0000-0000000000f1','Rossini Ada','3331112299', 2),
  ('e1000000-0000-0000-0000-0000000000m3','e1000000-0000-0000-0000-0000000000f1','Nicolò Bianchi','3339990000', 0),
  ('e1000000-0000-0000-0000-0000000000m4','e1000000-0000-0000-0000-0000000000f1','De Rossi Ugo', null, 0),
  ('e1000000-0000-0000-0000-0000000000m5','e1000000-0000-0000-0000-0000000000f2','Marco Neri','3331112233', 0);

-- De Rossi ha giocato ieri, Rossi Luca un anno fa: a parità di rank il più
-- recente sta sopra, e questa è l'unica coppia che lo mette alla prova.
insert into public.bookings (facility_id, field_id, member_id, slot, status, price_cents, cancel_deadline) values
  ('e1000000-0000-0000-0000-0000000000f1','e1000000-0000-0000-0000-0000000000fd',
   'e1000000-0000-0000-0000-0000000000m4',
   tstzrange(now() - interval '1 day', now() - interval '1 day' + interval '1 hour'),
   'active', 2500, now() - interval '2 days'),
  ('e1000000-0000-0000-0000-0000000000f1','e1000000-0000-0000-0000-0000000000fd',
   'e1000000-0000-0000-0000-0000000000m1',
   tstzrange(now() - interval '365 days', now() - interval '365 days' + interval '1 hour'),
   'active', 2500, now() - interval '366 days');

set local role authenticated;
set local request.jwt.claims to '{"sub":"e1000000-0000-0000-0000-0000000000ua","role":"authenticated"}';

select is(
  (select name from public.search_members('e1000000-0000-0000-0000-0000000000f1','3331112233') limit 1),
  'Rossi Luca',
  'il telefono esatto vince su tutto');

select is(
  (select array_agg(name order by ord) from (
     select name, row_number() over () as ord
       from public.search_members('e1000000-0000-0000-0000-0000000000f1','333111')) s),
  array['Rossi Luca','Rossini Ada'],
  'il prefisso del telefono trova entrambi, in ordine di indice');

select is(
  (select rank from public.search_members('e1000000-0000-0000-0000-0000000000f1','Rossi') where name = 'Rossi Luca'),
  3::smallint,
  'il nome che comincia per ha rank 3');

select is(
  (select rank from public.search_members('e1000000-0000-0000-0000-0000000000f1','Rossi') where name = 'De Rossi Ugo'),
  4::smallint,
  'il nome che contiene ha rank 4');

select is(
  (select name from public.search_members('e1000000-0000-0000-0000-0000000000f1','Rossi') limit 1),
  'Rossi Luca',
  'chi comincia per sta sopra a chi contiene');

select is(
  (select name from public.search_members('e1000000-0000-0000-0000-0000000000f1','Nicolo') limit 1),
  'Nicolò Bianchi',
  'gli accenti si ignorano: «Nicolo» trova «Nicolò»');

select is(
  (select has_missed from public.search_members('e1000000-0000-0000-0000-0000000000f1','Rossini') limit 1),
  true,
  'chi ha almeno una mancata presentazione è segnalato nella riga');

select is_empty(
  $$select * from public.search_members('e1000000-0000-0000-0000-0000000000f2','3331112233')$$,
  'un gestore non vede i clienti di una struttura che non amministra, nemmeno col numero esatto');

select is_empty(
  $$select * from public.search_members('e1000000-0000-0000-0000-0000000000f1','R')$$,
  'sotto i due caratteri non si cerca');

select * from finish();
rollback;
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npm run test:db`
Expected: `014_member_search.test.sql` fails — `function public.search_members(uuid, text) does not exist`. Every other file still passes.

- [ ] **Step 4: Write the migration**

Create `supabase/migrations/0020_member_search.sql`:

```sql
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
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npm run db:reset && npm run test:db`
Expected: every file passes; the total rises by 9.

- [ ] **Step 6: Regenerate the types**

Run: `npm run types`
Expected: `src/shared/lib/database.types.ts` gains `search_members` under `Functions`. Check it in with the migration — a stale types file is how the next task discovers this one was skipped.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0020_member_search.sql supabase/tests/014_member_search.test.sql src/shared/lib/database.types.ts
git commit -m "feat(db): rank member search where pgTAP can pin the order"
```

---

## Task 2: `member_card`, and counting appearances from the truth

**Files:**
- Create: `supabase/migrations/0021_member_card.sql`
- Create: `supabase/tests/015_member_card.test.sql`

**Interfaces:**
- Produces: `public.member_card(p_member_id uuid) returns table (id uuid, name text, phone text, email text, price_list text, notes text, appearances integer, missed integer, last_played timestamptz, usual_field_name text)` — zero rows when the caller may not read that member.

Spec §2.5: `honored_count` is incremented by nothing, so the percentage it feeds can only be `null` or `0%`. Appearances are counted here from `bookings` instead — a booking that is `active` with a slot already past is an appearance, because nobody marked it `no_show`.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/015_member_card.test.sql`:

```sql
begin;
select plan(7);

insert into public.facilities (id, slug, name, booking_horizon_days) values
  ('e2000000-0000-0000-0000-0000000000f1', 'test-card', 'Struttura Card', 3650);
insert into public.fields (id, facility_id, name, kind) values
  ('e2000000-0000-0000-0000-0000000000d1','e2000000-0000-0000-0000-0000000000f1','Campo 1','calcio5'),
  ('e2000000-0000-0000-0000-0000000000d2','e2000000-0000-0000-0000-0000000000f1','Campo 2','calcio5');

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','e2000000-0000-0000-0000-0000000000ua',
   'authenticated','authenticated','390000000301', now(), '','','','', now(), now());
insert into public.facility_admins (facility_id, user_id)
  values ('e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000ua');

insert into public.members (id, facility_id, name, phone, price_list, notes, honored_count, missed_count) values
  ('e2000000-0000-0000-0000-0000000000m1','e2000000-0000-0000-0000-0000000000f1',
   'Abbonato Storico','3331110000','ridotto','Paga sempre in contanti', 0, 1),
  ('e2000000-0000-0000-0000-0000000000m2','e2000000-0000-0000-0000-0000000000f1',
   'Cliente Nuovo', '3331110001','standard', null, 0, 0);

-- Due partite passate sul Campo 1, una sul Campo 2, una futura e una disdetta:
-- le presenze sono 3, il campo abituale è il Campo 1.
insert into public.bookings (facility_id, field_id, member_id, slot, status, price_cents, cancel_deadline) values
  ('e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000d1','e2000000-0000-0000-0000-0000000000m1',
   tstzrange(now() - interval '20 days', now() - interval '20 days' + interval '1 hour'), 'active', 2500, now() - interval '21 days'),
  ('e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000d1','e2000000-0000-0000-0000-0000000000m1',
   tstzrange(now() - interval '10 days', now() - interval '10 days' + interval '1 hour'), 'active', 2500, now() - interval '11 days'),
  ('e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000d2','e2000000-0000-0000-0000-0000000000m1',
   tstzrange(now() - interval '5 days', now() - interval '5 days' + interval '1 hour'), 'active', 2500, now() - interval '6 days'),
  ('e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000d1','e2000000-0000-0000-0000-0000000000m1',
   tstzrange(now() + interval '3 days', now() + interval '3 days' + interval '1 hour'), 'active', 2500, now() + interval '2 days'),
  ('e2000000-0000-0000-0000-0000000000f1','e2000000-0000-0000-0000-0000000000d1','e2000000-0000-0000-0000-0000000000m1',
   tstzrange(now() - interval '2 days', now() - interval '2 days' + interval '1 hour'), 'cancelled', 2500, now() - interval '3 days');

set local role authenticated;
set local request.jwt.claims to '{"sub":"e2000000-0000-0000-0000-0000000000ua","role":"authenticated"}';

select is(
  (select appearances from public.member_card('e2000000-0000-0000-0000-0000000000m1')),
  3, 'le presenze contano le prenotazioni passate non disdette, e non quelle future');

select is(
  (select missed from public.member_card('e2000000-0000-0000-0000-0000000000m1')),
  1, 'le mancate presentazioni arrivano dal contatore, che viene davvero incrementato');

select is(
  (select usual_field_name from public.member_card('e2000000-0000-0000-0000-0000000000m1')),
  'Campo 1', 'il campo abituale è quello scelto più spesso');

select ok(
  (select last_played from public.member_card('e2000000-0000-0000-0000-0000000000m1'))
    < now() - interval '4 days',
  'l''ultima volta è la partita passata più recente, non quella prenotata per la settimana prossima');

select is(
  (select notes from public.member_card('e2000000-0000-0000-0000-0000000000m1')),
  'Paga sempre in contanti', 'le note interne arrivano al gestore');

select is(
  (select appearances from public.member_card('e2000000-0000-0000-0000-0000000000m2')),
  0, 'un cliente senza storia ha zero presenze, e la riga esiste lo stesso');

select is(
  (select usual_field_name from public.member_card('e2000000-0000-0000-0000-0000000000m2')),
  null, 'senza partite non c''è un campo abituale, e non si inventa');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:db`
Expected: `function public.member_card(uuid) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0021_member_card.sql`:

```sql
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
```

- [ ] **Step 4: Run the test and watch it pass**

Run: `npm run db:reset && npm run test:db`
Expected: all files pass, total up by 7.

- [ ] **Step 5: Regenerate the types and commit**

```bash
npm run types
git add supabase/migrations/0021_member_card.sql supabase/tests/015_member_card.test.sql src/shared/lib/database.types.ts
git commit -m "feat(db): a member card that counts appearances from bookings, not from a dead counter"
```

---

## Task 3: `useMemberSearch`

**Files:**
- Create: `src/features/admin/hooks/useMemberSearch.ts`
- Test: `src/features/admin/hooks/useMemberSearch.test.ts`

**Interfaces:**
- Consumes: `search_members` from Task 1.
- Produces:
  ```ts
  export type MemberHit = { id: string; name: string; phone: string | null; hasMissed: boolean }
  export function useMemberSearch(query: string): {
    results: MemberHit[]
    isPending: boolean
    failed: boolean
  }
  ```
  `failed` rather than `error`: the only thing any caller does with a search failure is fall back (spec §2.8), and a boolean says that without inviting anyone to render a database message beside a name field.

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/hooks/useMemberSearch.test.ts`:

```ts
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMemberSearch } from './useMemberSearch'
import { supabase } from '@/shared/lib/supabase'

vi.mock('@/shared/tenant/FacilityProvider', () => ({
  useFacility: () => ({ id: 'f1' }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useMemberSearch', () => {
  it('non interroga il database sotto i due caratteri', async () => {
    const rpc = vi.spyOn(supabase, 'rpc')
    const { result } = renderHook(() => useMemberSearch('R'), { wrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(rpc).not.toHaveBeenCalled()
    expect(result.current.results).toEqual([])
  })

  it('mappa le righe e segnala chi ha una mancata presentazione', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [{ id: 'm1', name: 'Rossi Luca', phone: '3331112233', has_missed: true, rank: 1 }],
      error: null,
    } as never)
    const { result } = renderHook(() => useMemberSearch('Rossi'), { wrapper })
    await waitFor(() => expect(result.current.results).toHaveLength(1))
    expect(result.current.results[0]).toEqual({
      id: 'm1', name: 'Rossi Luca', phone: '3331112233', hasMissed: true,
    })
    expect(result.current.failed).toBe(false)
  })

  it('se la ricerca fallisce lo dice con `failed`, senza risultati e senza lanciare', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: null, error: { message: 'boom' },
    } as never)
    const { result } = renderHook(() => useMemberSearch('Rossi'), { wrapper })
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.results).toEqual([])
  })
})
```

Rename the file to `.tsx` if the JSX in `wrapper` makes `tsc -b` complain — the repo's other hook tests that render a provider already use `.tsx`; check `src/features/admin/hooks/` and follow whichever extension the neighbours use.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/admin/hooks/useMemberSearch`
Expected: FAIL — cannot resolve `./useMemberSearch`.

- [ ] **Step 3: Write the hook**

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'

export type MemberHit = {
  id: string
  name: string
  phone: string | null
  hasMissed: boolean
}

/** Sotto i due caratteri corrisponderebbe mezza rubrica: non si interroga. */
const MIN_QUERY = 2

/**
 * La ricerca che gira a ogni tasto. L'ordine non si tocca qui: arriva già
 * deciso da `search_members`, dove pgTAP lo prova caso per caso. Rimetterlo
 * in ordine nel client vorrebbe dire avere due regole, e la seconda è quella
 * che nessuno si accorge che è cambiata.
 */
export function useMemberSearch(query: string) {
  const facility = useFacility()
  const q = query.trim()
  const enabled = q.length >= MIN_QUERY

  const { data, isPending, error } = useQuery({
    queryKey: ['member-search', facility.id, q],
    enabled,
    // Il gestore sta scrivendo: una risposta di mezzo secondo fa resta buona,
    // e rifarla a ogni tasto non cambierebbe ciò che legge.
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<MemberHit[]> => {
      const { data, error } = await supabase.rpc('search_members', {
        p_facility: facility.id,
        p_query: q,
      })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        hasMissed: r.has_missed,
      }))
    },
  })

  return {
    results: data ?? [],
    isPending: enabled && isPending,
    failed: !!error,
  }
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run src/features/admin/hooks/useMemberSearch && npx tsc -b`
Expected: 3 passed, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/hooks/useMemberSearch.*
git commit -m "feat(admin): a member search hook that degrades instead of throwing"
```

---

## Task 4: `useMemberCard`

**Files:**
- Create: `src/features/admin/hooks/useMemberCard.ts`
- Test: `src/features/admin/hooks/useMemberCard.test.tsx`

**Interfaces:**
- Consumes: `member_card` from Task 2.
- Produces:
  ```ts
  export type MemberCardData = {
    id: string
    name: string
    phone: string | null
    email: string | null
    priceList: string
    notes: string | null
    appearances: number
    missed: number
    lastPlayed: Date | null
    usualFieldName: string | null
  }
  export function useMemberCard(memberId: string | null): {
    card: MemberCardData | null
    isPending: boolean
    failed: boolean
  }
  ```

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/hooks/useMemberCard.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useMemberCard } from './useMemberCard'
import { supabase } from '@/shared/lib/supabase'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useMemberCard', () => {
  it('non interroga niente senza un cliente scelto', async () => {
    const rpc = vi.spyOn(supabase, 'rpc')
    const { result } = renderHook(() => useMemberCard(null), { wrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(rpc).not.toHaveBeenCalled()
    expect(result.current.card).toBeNull()
  })

  it('converte la data in Date e lascia null quando non c’è storia', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [{
        id: 'm2', name: 'Cliente Nuovo', phone: null, email: null,
        price_list: 'standard', notes: null,
        appearances: 0, missed: 0, last_played: null, usual_field_name: null,
      }],
      error: null,
    } as never)
    const { result } = renderHook(() => useMemberCard('m2'), { wrapper })
    await waitFor(() => expect(result.current.card).not.toBeNull())
    expect(result.current.card).toEqual({
      id: 'm2', name: 'Cliente Nuovo', phone: null, email: null,
      priceList: 'standard', notes: null,
      appearances: 0, missed: 0, lastPlayed: null, usualFieldName: null,
    })
  })

  it('converte last_played in una Date quando c’è', async () => {
    vi.spyOn(supabase, 'rpc').mockResolvedValue({
      data: [{
        id: 'm1', name: 'Abbonato', phone: '333', email: null,
        price_list: 'ridotto', notes: 'contanti',
        appearances: 3, missed: 1,
        last_played: '2026-09-01T18:00:00+00:00', usual_field_name: 'Campo 1',
      }],
      error: null,
    } as never)
    const { result } = renderHook(() => useMemberCard('m1'), { wrapper })
    await waitFor(() => expect(result.current.card).not.toBeNull())
    expect(result.current.card!.lastPlayed).toBeInstanceOf(Date)
    expect(result.current.card!.appearances).toBe(3)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/admin/hooks/useMemberCard`
Expected: FAIL — cannot resolve `./useMemberCard`.

- [ ] **Step 3: Write the hook**

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'

export type MemberCardData = {
  id: string
  name: string
  phone: string | null
  email: string | null
  priceList: string
  notes: string | null
  appearances: number
  missed: number
  lastPlayed: Date | null
  usualFieldName: string | null
}

/**
 * La scheda si apre una volta per telefonata, non a ogni tasto: per questo è
 * separata da `useMemberSearch` e può permettersi gli aggregati sullo storico.
 */
export function useMemberCard(memberId: string | null) {
  const { data, isPending, error } = useQuery({
    queryKey: ['member-card', memberId],
    enabled: !!memberId,
    retry: false,
    queryFn: async (): Promise<MemberCardData | null> => {
      const { data, error } = await supabase.rpc('member_card', {
        p_member_id: memberId!,
      })
      if (error) throw error
      const row = (data ?? [])[0]
      if (!row) return null
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        priceList: row.price_list,
        notes: row.notes,
        appearances: row.appearances,
        missed: row.missed,
        lastPlayed: row.last_played ? new Date(row.last_played) : null,
        usualFieldName: row.usual_field_name,
      }
    },
  })

  return {
    card: data ?? null,
    isPending: !!memberId && isPending,
    failed: !!error,
  }
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run src/features/admin/hooks/useMemberCard && npx tsc -b`
Expected: 3 passed, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/hooks/useMemberCard.*
git commit -m "feat(admin): fetch a member's card once per selection"
```

---

## Task 5: the two writes, and the sentence a collision produces

**Files:**
- Create: `src/features/admin/utils/memberMessages.ts`
- Create: `src/features/admin/utils/memberMessages.test.ts`
- Create: `src/features/admin/hooks/useUpdateMemberNotes.ts`
- Create: `src/features/admin/hooks/useUpdateMemberNotes.test.tsx`
- Create: `src/features/admin/hooks/useCreateMember.ts`
- Create: `src/features/admin/hooks/useCreateMember.test.tsx`

**Interfaces:**
- Produces:
  ```ts
  // memberMessages.ts
  export const PHONE_TAKEN = 'phone-taken'
  export function memberMessage(error: unknown, action: 'save' | 'create'): string
  export function isPhoneTaken(error: unknown): boolean

  // useUpdateMemberNotes.ts
  export function useUpdateMemberNotes(): {
    saveNotes: (memberId: string, notes: string) => Promise<void>
    saving: boolean
    saveError: string | null
  }

  // useCreateMember.ts
  export function useCreateMember(): {
    createMember: (input: { name: string; phone: string }) => Promise<string>
    creating: boolean
  }
  ```
  `createMember` resolves to the new member's id and **rejects** on collision; the dialog in Task 8 catches it and asks `isPhoneTaken`.

- [ ] **Step 1: Write the failing message test**

Create `src/features/admin/utils/memberMessages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isPhoneTaken, memberMessage } from './memberMessages'

describe('memberMessages', () => {
  it('riconosce la violazione di unicità del telefono', () => {
    expect(isPhoneTaken({ code: '23505' })).toBe(true)
    expect(isPhoneTaken({ code: '23514' })).toBe(false)
    expect(isPhoneTaken(new Error('boom'))).toBe(false)
  })

  it('dice cosa non è riuscito, non cosa ha risposto il database', () => {
    expect(memberMessage(new Error('boom'), 'save'))
      .toBe('Non siamo riusciti a salvare la nota. Riprova.')
    expect(memberMessage(new Error('boom'), 'create'))
      .toBe('Non siamo riusciti a creare il cliente. Riprova.')
  })

  it('sulla collisione del telefono spiega cosa è successo, non che è un errore', () => {
    expect(memberMessage({ code: '23505' }, 'create'))
      .toBe('Questo numero è già di un altro cliente. Qualcuno potrebbe averlo appena creato: cerca di nuovo.')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/admin/utils/memberMessages`
Expected: FAIL — cannot resolve `./memberMessages`.

- [ ] **Step 3: Write the messages**

```ts
/**
 * Un errore che il gestore legge deve dire cosa non è riuscito e cosa può
 * fare, mai riportare la risposta del database. `closureMessages.ts` e
 * `bandMessages.ts` fanno lo stesso per le loro schermate, e restano tre file
 * distinti apposta: ognuno mappa SQLSTATE diversi su azioni diverse.
 */

/** Unique violation: l'indice su `phone_key(phone)` ha rifiutato la riga. */
const UNIQUE_VIOLATION = '23505'

export function isPhoneTaken(error: unknown): boolean {
  return typeof error === 'object' && error !== null
    && (error as { code?: string }).code === UNIQUE_VIOLATION
}

export function memberMessage(error: unknown, action: 'save' | 'create'): string {
  if (isPhoneTaken(error)) {
    return 'Questo numero è già di un altro cliente. Qualcuno potrebbe averlo appena creato: cerca di nuovo.'
  }
  return action === 'save'
    ? 'Non siamo riusciti a salvare la nota. Riprova.'
    : 'Non siamo riusciti a creare il cliente. Riprova.'
}
```

- [ ] **Step 4: Write the failing hook tests**

Create `src/features/admin/hooks/useUpdateMemberNotes.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useUpdateMemberNotes } from './useUpdateMemberNotes'
import { supabase } from '@/shared/lib/supabase'

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function stubUpdate(result: { data: unknown; error: unknown }) {
  const select = vi.fn().mockResolvedValue(result)
  const eq = vi.fn().mockReturnValue({ select })
  const update = vi.fn().mockReturnValue({ eq })
  vi.spyOn(supabase, 'from').mockReturnValue({ update } as never)
  return { update, eq, select }
}

describe('useUpdateMemberNotes', () => {
  it('salva la nota e chiede indietro la riga scritta', async () => {
    const { update, select } = stubUpdate({ data: [{ id: 'm1' }], error: null })
    const { result } = renderHook(() => useUpdateMemberNotes(), { wrapper })
    await act(() => result.current.saveNotes('m1', 'contanti'))
    expect(update).toHaveBeenCalledWith({ notes: 'contanti' })
    expect(select).toHaveBeenCalled()
    expect(result.current.saveError).toBeNull()
  })

  it('zero righe scritte è un fallimento, anche senza errore', async () => {
    stubUpdate({ data: [], error: null })
    const { result } = renderHook(() => useUpdateMemberNotes(), { wrapper })
    await act(() => result.current.saveNotes('m1', 'contanti').catch(() => {}))
    expect(result.current.saveError)
      .toBe('Non siamo riusciti a salvare la nota. Riprova.')
  })

  it('una nota svuotata diventa null, non una stringa vuota', async () => {
    const { update } = stubUpdate({ data: [{ id: 'm1' }], error: null })
    const { result } = renderHook(() => useUpdateMemberNotes(), { wrapper })
    await act(() => result.current.saveNotes('m1', '   '))
    expect(update).toHaveBeenCalledWith({ notes: null })
  })
})
```

Create `src/features/admin/hooks/useCreateMember.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useCreateMember } from './useCreateMember'
import { isPhoneTaken } from '../utils/memberMessages'
import { supabase } from '@/shared/lib/supabase'

vi.mock('@/shared/tenant/FacilityProvider', () => ({
  useFacility: () => ({ id: 'f1' }),
}))

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

function stubInsert(result: { data: unknown; error: unknown }) {
  const single = vi.fn().mockResolvedValue(result)
  const select = vi.fn().mockReturnValue({ single })
  const insert = vi.fn().mockReturnValue({ select })
  vi.spyOn(supabase, 'from').mockReturnValue({ insert } as never)
  return { insert }
}

describe('useCreateMember', () => {
  it('crea il cliente e restituisce il suo id', async () => {
    const { insert } = stubInsert({ data: { id: 'm9' }, error: null })
    const { result } = renderHook(() => useCreateMember(), { wrapper })
    let id = ''
    await act(async () => { id = await result.current.createMember({ name: ' Mario ', phone: '333 111 22 33' }) })
    expect(id).toBe('m9')
    expect(insert).toHaveBeenCalledWith({
      facility_id: 'f1', name: 'Mario', phone: '3331112233',
    })
  })

  it('senza numero scrive null, non una stringa vuota', async () => {
    const { insert } = stubInsert({ data: { id: 'm9' }, error: null })
    const { result } = renderHook(() => useCreateMember(), { wrapper })
    await act(() => result.current.createMember({ name: 'Mario', phone: '' }))
    expect(insert).toHaveBeenCalledWith({
      facility_id: 'f1', name: 'Mario', phone: null,
    })
  })

  it('rilancia la collisione in modo che il chiamante la riconosca', async () => {
    stubInsert({ data: null, error: { code: '23505', message: 'duplicate key' } })
    const { result } = renderHook(() => useCreateMember(), { wrapper })
    let caught: unknown = null
    await act(async () => {
      caught = await result.current.createMember({ name: 'Mario', phone: '3331112233' }).catch((e) => e)
    })
    expect(isPhoneTaken(caught)).toBe(true)
  })
})
```

- [ ] **Step 5: Run both and watch them fail**

Run: `npx vitest run src/features/admin/hooks/useUpdateMemberNotes src/features/admin/hooks/useCreateMember`
Expected: FAIL — modules cannot be resolved.

- [ ] **Step 6: Write the two hooks**

`src/features/admin/hooks/useUpdateMemberNotes.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { memberMessage } from '../utils/memberMessages'

/**
 * L'unica scrittura possibile dalla scheda. Le note si salvano uscendo dal
 * campo e anche se la prenotazione poi non si fa: riguardano la persona, non
 * l'appuntamento.
 */
export function useUpdateMemberNotes() {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({ memberId, notes }: { memberId: string; notes: string }) => {
      const trimmed = notes.trim()
      // `select()` dopo la `update`: una scrittura esclusa dalla clausola
      // `using` di RLS non corrisponde a nessuna riga e NON restituisce
      // errore. Senza la riga indietro, «non ho scritto niente» e «ho scritto»
      // sono indistinguibili.
      const { data, error } = await supabase
        .from('members')
        .update({ notes: trimmed === '' ? null : trimmed })
        .eq('id', memberId)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('nessuna riga aggiornata')
      return memberId
    },
    onSuccess: (memberId) => {
      qc.invalidateQueries({ queryKey: ['member-card', memberId] })
    },
  })

  return {
    saveNotes: async (memberId: string, notes: string) => {
      await mutation.mutateAsync({ memberId, notes })
    },
    saving: mutation.isPending,
    saveError: mutation.error ? memberMessage(mutation.error, 'save') : null,
  }
}
```

`src/features/admin/hooks/useCreateMember.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'

/**
 * La creazione deliberata. Non c'è più nessuna euristica che inserisca una
 * scheda per conto suo: è l'unico punto in cui nasce un cliente, e costa un
 * gesto esplicito perché è l'unico momento in cui nascono i doppioni.
 *
 * L'errore di collisione viene rilanciato così com'è, con il suo `code`: solo
 * il chiamante sa se mostrarlo come domanda («è questo?») o come messaggio.
 */
export function useCreateMember() {
  const facility = useFacility()
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({ name, phone }: { name: string; phone: string }) => {
      const digits = phone.replace(/\D/g, '')
      const { data, error } = await supabase
        .from('members')
        .insert({
          facility_id: facility.id,
          name: name.trim(),
          phone: digits === '' ? null : digits,
        })
        .select('id')
        .single()
      if (error) throw error
      if (!data) throw new Error('nessuna riga creata')
      return data.id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member-search', facility.id] })
    },
  })

  return {
    createMember: (input: { name: string; phone: string }) => mutation.mutateAsync(input),
    creating: mutation.isPending,
  }
}
```

- [ ] **Step 7: Run everything and typecheck**

Run: `npx vitest run src/features/admin/utils/memberMessages src/features/admin/hooks/useUpdateMemberNotes src/features/admin/hooks/useCreateMember && npx tsc -b`
Expected: 9 passed, exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/features/admin/utils/memberMessages.* src/features/admin/hooks/useUpdateMemberNotes.* src/features/admin/hooks/useCreateMember.*
git commit -m "feat(admin): the two member writes, each proving it wrote"
```

---

## Task 6: `MemberCard`

**Files:**
- Create: `src/features/admin/components/MemberCard.tsx`
- Test: `src/features/admin/components/MemberCard.test.tsx`

**Interfaces:**
- Consumes: `MemberCardData` from Task 4.
- Produces:
  ```ts
  export function MemberCard({ card, onNotesBlur, saveError }: {
    card: MemberCardData
    onNotesBlur: (notes: string) => void
    saveError: string | null
  }): JSX.Element
  ```
  Presentational: it fetches nothing and owns only the notes draft.

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/components/MemberCard.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemberCard } from './MemberCard'
import type { MemberCardData } from '../hooks/useMemberCard'

const base: MemberCardData = {
  id: 'm1', name: 'Rossi Luca', phone: '3331112233', email: null,
  priceList: 'standard', notes: null,
  appearances: 0, missed: 0, lastPlayed: null, usualFieldName: null,
}

describe('MemberCard', () => {
  it('un cliente senza storia è «nuovo», non uno allo zero per cento', () => {
    render(<MemberCard card={base} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByText('Cliente nuovo')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('conta le presenze e le mancate a parole, senza percentuali', () => {
    render(<MemberCard card={{ ...base, appearances: 23, missed: 2 }} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByText('Si è presentato 23 volte, 2 mancate')).toBeInTheDocument()
  })

  it('al singolare concorda: una volta, una mancata', () => {
    render(<MemberCard card={{ ...base, appearances: 1, missed: 1 }} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByText('Si è presentato 1 volta, 1 mancata')).toBeInTheDocument()
  })

  it('senza mancate non nomina le mancate', () => {
    render(<MemberCard card={{ ...base, appearances: 5, missed: 0 }} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByText('Si è presentato 5 volte')).toBeInTheDocument()
  })

  it('mostra il listino solo quando non è quello standard', () => {
    const { rerender } = render(<MemberCard card={base} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.queryByText(/Listino/)).not.toBeInTheDocument()
    rerender(<MemberCard card={{ ...base, priceList: 'ridotto' }} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByText('Listino ridotto')).toBeInTheDocument()
  })

  it('dice il campo abituale quando c’è', () => {
    render(<MemberCard card={{ ...base, appearances: 3, usualFieldName: 'Campo 1' }} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByText(/Di solito Campo 1/)).toBeInTheDocument()
  })

  it('salva le note uscendo dal campo, non con un pulsante', () => {
    const onNotesBlur = vi.fn()
    render(<MemberCard card={base} onNotesBlur={onNotesBlur} saveError={null} />)
    const notes = screen.getByRole('textbox', { name: 'Note interne' })
    fireEvent.change(notes, { target: { value: 'Paga in contanti' } })
    expect(onNotesBlur).not.toHaveBeenCalled()
    fireEvent.blur(notes)
    expect(onNotesBlur).toHaveBeenCalledWith('Paga in contanti')
  })

  it('non risalva una nota che non è cambiata', () => {
    const onNotesBlur = vi.fn()
    render(<MemberCard card={{ ...base, notes: 'Paga in contanti' }} onNotesBlur={onNotesBlur} saveError={null} />)
    fireEvent.blur(screen.getByRole('textbox', { name: 'Note interne' }))
    expect(onNotesBlur).not.toHaveBeenCalled()
  })

  it('dice se il salvataggio della nota non è riuscito', () => {
    render(<MemberCard card={base} onNotesBlur={() => {}} saveError="Non siamo riusciti a salvare la nota. Riprova." />)
    expect(screen.getByText('Non siamo riusciti a salvare la nota. Riprova.')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/admin/components/MemberCard`
Expected: FAIL — cannot resolve `./MemberCard`.

- [ ] **Step 3: Write the component**

```tsx
import { useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import type { MemberCardData } from '../hooks/useMemberCard'

/**
 * Quello che il gestore legge mentre parla.
 *
 * Niente percentuali, per scelta: `honored_count` non lo incrementa nessuno,
 * quindi `member_reliability` varrebbe `null` oppure `0%` e basta — un cliente
 * con cinquanta presenze e una assenza leggerebbe zero. Qui le presenze si
 * contano dalle prenotazioni passate e si dicono a parole: una percentuale
 * invita a confrontare le persone e nasconde su quanti casi è calcolata.
 */
function reliabilitySentence(appearances: number, missed: number): string {
  if (appearances === 0 && missed === 0) return 'Cliente nuovo'
  const shown = `Si è presentato ${appearances} ${appearances === 1 ? 'volta' : 'volte'}`
  if (missed === 0) return shown
  return `${shown}, ${missed} ${missed === 1 ? 'mancata' : 'mancate'}`
}

export function MemberCard({ card, onNotesBlur, saveError }: {
  card: MemberCardData
  onNotesBlur: (notes: string) => void
  saveError: string | null
}) {
  const [draft, setDraft] = useState(card.notes ?? '')

  const history: string[] = []
  if (card.lastPlayed) {
    history.push(`Ultima volta ${format(card.lastPlayed, 'd MMM yyyy', { locale: it })}`)
  }
  if (card.usualFieldName) history.push(`Di solito ${card.usualFieldName}`)

  return (
    <div className="flex flex-col gap-2 rounded-[7px] border border-line-soft bg-surface-2 p-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[13px] font-medium">{card.name}</span>
        {card.phone && (
          <span className="tabular-nums text-[12px] text-muted">{card.phone}</span>
        )}
        {card.priceList !== 'standard' && (
          <span className="rounded-md bg-pitch-tint px-1.5 py-0.5 text-[11px] text-pitch">
            Listino {card.priceList}
          </span>
        )}
      </div>

      <p className="text-[12px] text-ink-2">{reliabilitySentence(card.appearances, card.missed)}</p>
      {history.length > 0 && (
        <p className="text-[11.5px] text-muted">{history.join(' · ')}</p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[.06em] text-muted">Note interne</span>
        <textarea
          className="field h-auto min-h-16 resize-y py-1.5 text-[12.5px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Si salva uscendo dal campo: al telefono si scrive di fretta, e una
          // nota persa perché nessuno ha cliccato è peggio di una scritta a
          // metà. Il confronto evita di riscrivere ciò che non è cambiato.
          onBlur={() => { if (draft !== (card.notes ?? '')) onNotesBlur(draft) }}
        />
      </label>

      {saveError && <ErrorNote message={saveError} />}
    </div>
  )
}
```

Check `src/shared/components/ui/ErrorNote.tsx` for its actual prop name before writing this — the panel's other screens all use it, and it is the only thing here imported from outside the feature.

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run src/features/admin/components/MemberCard && npx tsc -b`
Expected: 9 passed, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/components/MemberCard.*
git commit -m "feat(admin): a member card that counts in words, not percentages"
```

---

## Task 7: `MemberSearchField`

**Files:**
- Create: `src/features/admin/components/MemberSearchField.tsx`
- Test: `src/features/admin/components/MemberSearchField.test.tsx`

**Interfaces:**
- Consumes: `useMemberSearch`, `MemberHit` from Task 3.
- Produces:
  ```ts
  export type MemberChoice =
    | { kind: 'none' }
    | { kind: 'existing'; member: MemberHit }
    | { kind: 'new'; name: string }

  export function MemberSearchField({ choice, onChoose, inputRef }: {
    choice: MemberChoice
    onChoose: (c: MemberChoice) => void
    inputRef?: React.RefObject<HTMLInputElement | null>
  }): JSX.Element
  ```
  The field owns the typed text; the dialog owns `choice`, because it needs it at submit.

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/components/MemberSearchField.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemberSearchField } from './MemberSearchField'
import * as searchHook from '../hooks/useMemberSearch'

const hit = { id: 'm1', name: 'Rossi Luca', phone: '3331112233', hasMissed: false }

function stubSearch(over: Partial<ReturnType<typeof searchHook.useMemberSearch>> = {}) {
  vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
    results: [], isPending: false, failed: false, ...over,
  })
}

describe('MemberSearchField', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('mostra i risultati e sceglierne uno lo comunica al genitore', () => {
    stubSearch({ results: [hit] })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: /Rossi Luca/ }))
    expect(onChoose).toHaveBeenCalledWith({ kind: 'existing', member: hit })
  })

  it('segnala chi ha una mancata presentazione, senza numeri', () => {
    stubSearch({ results: [{ ...hit, hasMissed: true }] })
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    expect(screen.getByLabelText('Ha mancato almeno una prenotazione')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('creare un cliente nuovo è un gesto esplicito, non il ripiego automatico', () => {
    stubSearch({ results: [] })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    expect(onChoose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    expect(onChoose).toHaveBeenCalledWith({ kind: 'new', name: 'Mario Neri' })
  })

  it('se la ricerca fallisce si può comunque creare il cliente', () => {
    stubSearch({ failed: true })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    expect(screen.getByText('Non siamo riusciti a cercare fra i clienti: puoi comunque prenotare.'))
      .toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    expect(onChoose).toHaveBeenCalledWith({ kind: 'new', name: 'Mario Neri' })
  })

  it('un cliente scelto si può cambiare', () => {
    stubSearch()
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'existing', member: hit }} onChoose={onChoose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cambia cliente' }))
    expect(onChoose).toHaveBeenCalledWith({ kind: 'none' })
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/admin/components/MemberSearchField`
Expected: FAIL — cannot resolve `./MemberSearchField`.

- [ ] **Step 3: Write the component**

```tsx
import { useState } from 'react'
import { useMemberSearch, type MemberHit } from '../hooks/useMemberSearch'

export type MemberChoice =
  | { kind: 'none' }
  | { kind: 'existing'; member: MemberHit }
  | { kind: 'new'; name: string }

/**
 * Il campo che riconosce chi sta telefonando.
 *
 * Prima di questo, scegliere un suggerimento riempiva solo i due campi di
 * testo e poi `resolveMember` ricominciava a indovinare al salvataggio: si
 * poteva scegliere una persona e prenotare per un'altra. Qui la scelta è un
 * dato — `MemberChoice` — e il genitore la porta fino alla prenotazione.
 */
export function MemberSearchField({ choice, onChoose, inputRef }: {
  choice: MemberChoice
  onChoose: (c: MemberChoice) => void
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const [term, setTerm] = useState('')
  const { results, failed } = useMemberSearch(term)
  const typed = term.trim()

  if (choice.kind === 'existing') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] font-medium">{choice.member.name}</span>
        <button
          type="button"
          onClick={() => { setTerm(''); onChoose({ kind: 'none' }) }}
          className="rounded-md border border-line px-2 py-1 text-[12px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch pointer-coarse:min-h-11 pointer-coarse:px-3"
        >
          Cambia cliente
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[.06em] text-muted">Cliente</span>
        <input
          ref={inputRef}
          className="field"
          value={term}
          onChange={(e) => { setTerm(e.target.value); onChoose({ kind: 'none' }) }}
          autoComplete="off"
        />
      </label>

      {/* Il telefono sta squillando: una ricerca rotta è una degradazione,
          mai un blocco. Si può ancora creare il cliente e prenotare. */}
      {failed && (
        <p className="text-[11.5px] text-muted">
          Non siamo riusciti a cercare fra i clienti: puoi comunque prenotare.
        </p>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-[7px] border border-line-soft">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onChoose({ kind: 'existing', member: m })}
                className="flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left text-[12.5px] hover:bg-surface-2 pointer-coarse:min-h-11"
              >
                {m.name}
                <span className="tabular-nums text-[11px] text-muted">{m.phone ?? ''}</span>
                {/* L'elenco serve a riconoscere, la scheda a giudicare: qui un
                    segno, non un numero. */}
                {m.hasMissed && (
                  <span
                    aria-label="Ha mancato almeno una prenotazione"
                    className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-terra"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {typed.length > 0 && (
        <button
          type="button"
          onClick={() => onChoose({ kind: 'new', name: typed })}
          className="self-start rounded-md border border-line px-2 py-1 text-[12px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch pointer-coarse:min-h-11 pointer-coarse:px-3"
        >
          Nuovo cliente: {typed}
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `npx vitest run src/features/admin/components/MemberSearchField && npx tsc -b`
Expected: 5 passed, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/components/MemberSearchField.*
git commit -m "feat(admin): a search field whose choice is a value, not two filled inputs"
```

---

## Task 8: wire it into `NewBookingDialog`, and delete the guess

**Files:**
- Modify: `src/features/admin/components/NewBookingDialog.tsx`
- Delete: `src/features/admin/utils/pickMember.ts` and `src/features/admin/utils/pickMember.test.ts`
- Create: `src/features/admin/components/NewBookingDialog.memberLookup.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 3–7.
- Produces: nothing new. `NewBookingTarget` is unchanged, so `AdminPage`'s call site does not move.

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/components/NewBookingDialog.memberLookup.test.tsx`. Before writing it, open `src/features/admin/components/NewClosureDialog.test.tsx` and copy its mocking idiom for hooks and its `TIMEOUT` note — that file documents why these dialog tests carry a raised timeout, and this one is in the same family.

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NewBookingDialog } from './NewBookingDialog'
import * as searchHook from '../hooks/useMemberSearch'
import * as cardHook from '../hooks/useMemberCard'
import * as createMemberHook from '../hooks/useCreateMember'
import * as createBookingHook from '../hooks/useCreateBooking'
import type { MemberCardData } from '../hooks/useMemberCard'

vi.mock('@/shared/tenant/FacilityProvider', () => ({
  useFacility: () => ({ id: 'f1', min_duration_minutes: 60 }),
}))

const hit = { id: 'm1', name: 'Rossi Luca', phone: '3331112233', hasMissed: false }

const card: MemberCardData = {
  id: 'm1', name: 'Rossi Luca', phone: '3331112233', email: null,
  priceList: 'standard', notes: null,
  appearances: 4, missed: 0, lastPlayed: null, usualFieldName: null,
}

const target = {
  field: { id: 'c1', name: 'Campo 1', kind: 'calcio5' } as never,
  day: new Date('2026-09-17T12:00:00+02:00'),
  startMin: 21 * 60,
}

let createBooking: ReturnType<typeof vi.fn>

beforeEach(() => {
  vi.restoreAllMocks()
  createBooking = vi.fn().mockResolvedValue({ price_cents: 2500 })
  vi.spyOn(createBookingHook, 'useCreateBooking').mockReturnValue({
    mutateAsync: createBooking,
  } as never)
  vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
    results: [hit], isPending: false, failed: false,
  })
  vi.spyOn(cardHook, 'useMemberCard').mockReturnValue({
    card, isPending: false, failed: false,
  })
})

describe('NewBookingDialog — riconoscere chi telefona', () => {
  it('scegliendo un cliente mostra la sua scheda', async () => {
    render(<NewBookingDialog target={target} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: /Rossi Luca/ }))
    await waitFor(() => expect(screen.getByText('Si è presentato 4 volte')).toBeInTheDocument())
  }, 20_000)

  it('prenota con l’id del cliente scelto, non con uno indovinato dal nome', async () => {
    render(<NewBookingDialog target={target} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: /Rossi Luca/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(createBooking).toHaveBeenCalled())
    expect(createBooking.mock.calls[0][0]).toMatchObject({ memberId: 'm1', source: 'phone' })
  }, 20_000)

  it('senza nessuno scelto non prenota e dice perché', async () => {
    render(<NewBookingDialog target={target} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() =>
      expect(screen.getByText('Scegli un cliente dall’elenco, oppure creane uno nuovo.')).toBeInTheDocument())
    expect(createBooking).not.toHaveBeenCalled()
  }, 20_000)

  it('creando un cliente nuovo prenota con l’id appena creato', async () => {
    const createMember = vi.fn().mockResolvedValue('m9')
    vi.spyOn(createMemberHook, 'useCreateMember').mockReturnValue({
      createMember, creating: false,
    })
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: false,
    })
    render(<NewBookingDialog target={target} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(createMember).toHaveBeenCalledWith({ name: 'Mario Neri', phone: '' }))
    expect(createBooking.mock.calls[0][0]).toMatchObject({ memberId: 'm9' })
  }, 20_000)

  it('se il numero è già di un altro, lo dice invece di far arrivare un errore del database', async () => {
    const createMember = vi.fn().mockRejectedValue({ code: '23505', message: 'duplicate key' })
    vi.spyOn(createMemberHook, 'useCreateMember').mockReturnValue({
      createMember, creating: false,
    })
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: false,
    })
    render(<NewBookingDialog target={target} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefono' }), { target: { value: '3331112233' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() =>
      expect(screen.getByText(/Questo numero è già di un altro cliente/)).toBeInTheDocument())
    expect(createBooking).not.toHaveBeenCalled()
  }, 20_000)

  it('con la ricerca rotta si prenota lo stesso, creando il cliente', async () => {
    const createMember = vi.fn().mockResolvedValue('m9')
    vi.spyOn(createMemberHook, 'useCreateMember').mockReturnValue({
      createMember, creating: false,
    })
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: true,
    })
    render(<NewBookingDialog target={target} onClose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(createBooking).toHaveBeenCalled())
    expect(createBooking.mock.calls[0][0]).toMatchObject({ memberId: 'm9' })
  }, 20_000)
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/admin/components/NewBookingDialog.memberLookup`
Expected: FAIL — there is no textbox named `Cliente` yet; the dialog still renders `Nome`.

- [ ] **Step 3: Rewrite the dialog's member handling**

In `src/features/admin/components/NewBookingDialog.tsx`:

1. **Delete** the `resolveMember` function (lines ~22–55), the `useMemberSuggestions` hook at the bottom of the file, the `suggestions` variable, the suggestions `<ul>`, the `name` state, and the `Nome` label. Remove the now-unused imports: `useQuery`, `supabase`, `pickExistingMember`.
2. **Add** the choice state and the new controls:

```tsx
const [choice, setChoice] = useState<MemberChoice>({ kind: 'none' })
const { createMember } = useCreateMember()
const { card } = useMemberCard(choice.kind === 'existing' ? choice.member.id : null)
const { saveNotes, saveError } = useUpdateMemberNotes()
```

Reset it alongside the rest when the dialog opens:

```tsx
setChoice({ kind: 'none' }); setPhone(''); setError(null)
```

3. **Resolve the member at submit from the choice, never from the text:**

```tsx
async function memberIdFor(c: MemberChoice): Promise<string> {
  if (c.kind === 'existing') return c.member.id
  // `kind: 'new'` è l'unico punto in cui nasce un cliente, e ci si arriva solo
  // con un clic esplicito. Prima, `resolveMember` inseriva per conto suo ogni
  // volta che non riconosceva un nome.
  return await createMember({ name: c.name, phone })
}
```

and in `submit`:

```tsx
if (!target) return
if (choice.kind === 'none') {
  setError('Scegli un cliente dall’elenco, oppure creane uno nuovo.')
  return
}
setError(null)
try {
  const memberId = await memberIdFor(choice)
  …
} catch (e) {
  setError(isPhoneTaken(e) ? memberMessage(e, 'create')
    : e instanceof Error ? e.message
    : 'La prenotazione non è riuscita. Riprova.')
}
```

4. **Fix the submit button's `disabled` condition.** It currently reads
   `disabled={create.isPending || createRecurrence.isPending || !name.trim()}`,
   and `name` is being deleted. Do **not** replace it with a check on `choice`:
   a button that is disabled without saying why is worse than one that is
   enabled and tells the manager what is missing, and the test above asserts
   exactly that sentence. It becomes:

```tsx
disabled={create.isPending || createRecurrence.isPending || creating}
```

   where `creating` comes from `useCreateMember()`. The button's label stays
   «Conferma» / «Salvo…» — the tests query it by that name.

5. **Render** the field, the card, and the phone note:

```tsx
<MemberSearchField choice={choice} onChoose={setChoice} inputRef={nameRef} />

{choice.kind === 'existing' && card && (
  <MemberCard
    card={card}
    saveError={saveError}
    onNotesBlur={(notes) => { void saveNotes(card.id, notes) }}
  />
)}

{choice.kind === 'new' && phone.trim() === '' && (
  <p className="text-[11.5px] text-muted">
    Senza numero questo cliente non sarà riconoscibile la prossima volta.
  </p>
)}
```

The `Telefono` field stays where it is, and keeps `placeholder="facoltativo"`. Give it an accessible name of exactly `Telefono` — the test queries it by that.

6. The name used in the success toast comes from the choice, not from a text field:

```tsx
const bookedName = choice.kind === 'existing' ? choice.member.name : choice.name
```

- [ ] **Step 4: Delete the heuristic and its tests**

```bash
git rm src/features/admin/utils/pickMember.ts src/features/admin/utils/pickMember.test.ts
```

If anything else still imports `pickExistingMember`, `tsc -b` will say so — fix those call sites rather than keeping the file.

- [ ] **Step 5: Run the new tests, the full suite, and every gate**

Run:
```bash
npx vitest run src/features/admin/components/NewBookingDialog.memberLookup
npm run test
npx tsc -b && npm run lint && npm run build
npm run db:reset && npm run test:db
```
Expected: 6 passed in the new file; the whole unit suite green; exit 0 from typecheck, lint and build; every pgTAP file passing.

`BookPage.test.tsx` and `DayStrip.test.tsx` must pass **untouched** — they are the customer-facing regression guard and nothing in this plan should reach them. If either fails, stop and report rather than editing them.

- [ ] **Step 6: Commit**

```bash
git add -A src/features/admin
git commit -m "feat(admin): book for the customer the manager chose, not one guessed from a name"
```

---

## Self-review notes

Checked against the spec, section by section:

- §2.1 (the dialog stops guessing) → Task 8, including deleting `pickMember.ts`.
- §2.2 (ranking in Postgres, two functions split by frequency) → Tasks 1 and 2.
- §2.3 (one field, digits as a phone-key prefix, accents ignored) → Task 1, steps 1 and 4; the accent case is pinned in the pgTAP.
- §2.4 (the ranking, recency tie-break, eight rows, two characters, a mark not a number) → Task 1's test; the mark is rendered in Task 7.
- §2.5 (counts not percentages, appearances from `bookings`) → Task 2's function comment and Task 6's `reliabilitySentence`, with a test asserting no `%` appears.
- §2.6 (phone optional, cost stated) → Task 8, step 3, item 4.
- §2.7 (a taken number is a question; no "go on anyway") → Task 5's message and Task 8's collision test. Note the dialog offers **no** proceed button, per the spec's correction.
- §2.8 (a failed search never blocks) → `failed` in Task 3, the fallback line in Task 7, and the end-to-end case in Task 8.
- §3.1 (notes on blur, saved even if the booking is abandoned, proving it wrote) → Tasks 5 and 6.
- §6 (verification) → pgTAP in Tasks 1–2, Vitest in Tasks 3–8.

Two things deliberately **not** in any task, both out of scope per the spec: making `honored_count` work, and deduplicating members that already exist.

One deviation from the spec worth naming: it listed a single migration `0020_member_lookup.sql`; this plan uses two, `0020_member_search.sql` and `0021_member_card.sql`, so a reviewer can reject the ranking without also rejecting the card.

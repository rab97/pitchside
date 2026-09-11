# Facility Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the manager four screens — pitches, price bands, closures, club settings — so a club can be configured without opening a SQL client.

**Architecture:** Four routes behind the existing `RequireAdmin`, joined by one tab bar, writing straight to tables that already carry `*_write_admin` RLS policies. Two pieces of database work come first because the screens make them necessary: `price_bands` gets one row per weekday so an exclusion constraint can finally forbid overlaps, and one new RPC creates a closure and cancels the bookings it covers in a single transaction.

**Tech Stack:** React 19 · TypeScript · Vite 8 · Tailwind 4 (config in `src/index.css`, no `tailwind.config`) · TanStack Query v5 · React Router 7 · date-fns · Supabase (Postgres 17, RLS, pgTAP) · Vitest

**Spec:** `docs/superpowers/specs/2026-09-11-configurazione-impianto-design.md`

## Global Constraints

- Identifiers in English; **every string a user reads is Italian**. Comments, commit messages and docs are English (convention adopted 11 September 2026).
- Every domain table carries `facility_id`. No query crosses facilities.
- Money in cents (`integer`). Times of day in minutes from midnight (`0..1440`).
- Every instant is `timestamptz`; reference zone `Europe/Rome` from `src/shared/lib/tz.ts`.
- Writes to `bookings` go **only** through RPC. Writes to `fields`, `price_bands`, `closures`, `facilities` go straight to the table — the `*_write_admin` policies are the authorization.
- RLS is enabled in the same migration that creates a table; a `security definer` function **authorizes** before acting, it does not merely execute.
- Queries live in `hooks/`, one hook per file, name starts with `use`. Pure logic lives in `utils/`. Tests sit beside the file they prove.
- Imports use `@/...` across a feature boundary or into `shared/`; relative only inside the same folder.
- Typecheck with `npx tsc -b`. **`npx tsc --noEmit` checks nothing in this repo** — the root `tsconfig.json` has `"files": []`.
- Never run `docker … prune` or `pkill -f vite`: the machine is shared with other projects. Supabase containers here are `supabase_*_pitchside`.

---

### Task 1: One weekday per price band, and a constraint that means it

The band is picked by `calc_booking_price` with `select … limit 1` and no `order by`, so two overlapping bands make the price depend on which row Postgres returns. A `smallint[]` of weekdays cannot carry an exclusion constraint, so the row becomes one weekday and the rule becomes real. Spec §2.2.

**Files:**
- Create: `supabase/migrations/0018_price_band_weekday.sql`
- Create: `supabase/tests/012_price_band_overlap.test.sql`
- Modify: `supabase/seed.sql:18-27`
- Modify: `supabase/tests/003_price.test.sql`, `004_booking_overlap.test.sql`, `006_recurrences.test.sql`, `007_rpc_authorization.test.sql`, `009_slot_prices.test.sql` — each has one or two `insert into public.price_bands (… weekdays …)`
- Modify: `src/shared/lib/database.types.ts` — regenerated with `npm run types`, never hand-edited

**Interfaces:**
- Consumes: nothing.
- Produces: `public.price_bands` with column `weekday smallint not null check (weekday between 1 and 7)` replacing `weekdays smallint[]`; constraint `price_bands_no_overlap`. Later tasks read and write this shape.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/012_price_band_overlap.test.sql`. Fixture UUIDs follow the `d0000000-…` convention used by the other suites.

```sql
begin;
select plan(5);

insert into public.facilities (id, slug, name)
  values ('d0000000-0000-0000-0000-0000000000e1', 'test-bands', 'Test Bands');
insert into public.fields (id, facility_id, name, kind) values
  ('d0000000-0000-0000-0000-0000000000e2','d0000000-0000-0000-0000-0000000000e1','Campo 1','calcio5'),
  ('d0000000-0000-0000-0000-0000000000e3','d0000000-0000-0000-0000-0000000000e1','Campo 2','calcio5');

insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
  values ('d0000000-0000-0000-0000-0000000000e1','d0000000-0000-0000-0000-0000000000e2',1,540,1140,2000);

-- 1. l'ora e il giorno gia' coperti non si possono riscrivere
select throws_ok(
  $$insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
    values ('d0000000-0000-0000-0000-0000000000e1','d0000000-0000-0000-0000-0000000000e2',1,900,1200,2500)$$,
  '23P01',
  null,
  'una fascia che si sovrappone sullo stesso campo e giorno viene rifiutata');

-- 2. lo stesso orario su un altro giorno e' un caso normale
select lives_ok(
  $$insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
    values ('d0000000-0000-0000-0000-0000000000e1','d0000000-0000-0000-0000-0000000000e2',2,540,1140,2000)$$,
  'lo stesso orario su un altro giorno passa');

-- 3. e su un altro campo pure
select lives_ok(
  $$insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
    values ('d0000000-0000-0000-0000-0000000000e1','d0000000-0000-0000-0000-0000000000e3',1,540,1140,2000)$$,
  'lo stesso orario su un altro campo passa');

-- 4. due fasce che si toccano senza accavallarsi sono il caso normale:
--    l'intervallo e' chiuso a sinistra e aperto a destra
select lives_ok(
  $$insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
    values ('d0000000-0000-0000-0000-0000000000e1','d0000000-0000-0000-0000-0000000000e2',1,1140,1440,2500)$$,
  'una fascia che comincia dove finisce la precedente passa');

-- 5. il prezzo non e' piu' ambiguo: una sola fascia copre un minuto
select is(
  (select count(*)::int from public.price_bands pb
    where pb.field_id = 'd0000000-0000-0000-0000-0000000000e2'
      and pb.weekday = 1 and 1000 >= pb.starts_min and 1000 < pb.ends_min),
  1,
  'un minuto e coperto da una fascia sola');

select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:db`
Expected: FAIL — `column "weekday" of relation "price_bands" does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0018_price_band_weekday.sql`:

```sql
-- Una riga per giorno, invece di un array di giorni.
--
-- Il motivo non e' estetico: `calc_booking_price` sceglie la fascia con
-- `select ... limit 1` senza `order by`, quindi due fasce sovrapposte fanno
-- dipendere il prezzo da quale riga capita per prima. La specifica di fase 1
-- vieta le sovrapposizioni ma niente le impediva. Un vincolo di esclusione
-- confronta i valori di due righe con degli operatori, e per `smallint[]` non
-- esiste una classe di operatori che dica "questi giorni si accavallano con
-- quelli": con un giorno per riga il vincolo si puo' finalmente scrivere.
--
-- La fascia resta un'idea sola nell'interfaccia — si spuntano i giorni e si
-- salva una volta — e diventa piu' righe qui sotto.

-- 1. La colonna nuova, ancora libera di essere nulla mentre si espande.
alter table public.price_bands add column weekday smallint;

-- 2. Il prezzo atteso per ogni (campo, giorno, minuto d'inizio della fascia),
--    letto dal modello vecchio: e' la fotografia su cui la guardia in fondo
--    verifichera' che non si sia perso niente.
create temp table price_band_probe on commit drop as
select pb.field_id, d as weekday, pb.starts_min as minute, pb.price_cents
  from public.price_bands pb
  cross join lateral unnest(pb.weekdays) as d;

-- 3. Una riga per ciascun giorno dell'array; le originali restano
--    riconoscibili perche' hanno `weekday` nullo.
insert into public.price_bands
  (facility_id, field_id, weekdays, weekday, starts_min, ends_min, price_cents)
select pb.facility_id, pb.field_id, array[d]::smallint[], d,
       pb.starts_min, pb.ends_min, pb.price_cents
  from public.price_bands pb
  cross join lateral unnest(pb.weekdays) as d;

delete from public.price_bands where weekday is null;

-- 4. Il modello nuovo.
alter table public.price_bands
  alter column weekday set not null,
  add constraint price_bands_weekday_valid check (weekday between 1 and 7),
  drop column weekdays;

-- Se questo fallisce con 23P01, i dati contenevano gia' fasce sovrapposte:
-- vanno sistemate prima, non e' un difetto della migrazione. Era esattamente
-- il caso che nessuno poteva vedere finche' il vincolo non esisteva.
alter table public.price_bands
  add constraint price_bands_no_overlap exclude using gist (
    field_id with =,
    weekday with =,
    int4range(starts_min::int, ends_min::int) with &&
  );

-- 5. La guardia: nessun prezzo si e' mosso, e nessuna riga si e' persa.
--    Vale piu' di un test che gira dopo, perche' una migrazione che perde una
--    fascia non da' errore: fa sparire l'orario, e PS005 rende il campo non
--    prenotabile invece che gratis.
do $$
declare
  v_moved integer;
  v_expected integer;
  v_actual integer;
begin
  select count(*) into v_moved
    from price_band_probe p
   where not exists (
     select 1 from public.price_bands pb
      where pb.field_id = p.field_id
        and pb.weekday = p.weekday
        and p.minute >= pb.starts_min
        and p.minute <  pb.ends_min
        and pb.price_cents = p.price_cents
   );
  if v_moved > 0 then
    raise exception 'price band migration changed % price(s)', v_moved;
  end if;

  select count(*) into v_expected from price_band_probe;
  select count(*) into v_actual from public.price_bands;
  if v_expected <> v_actual then
    raise exception 'price band migration expected % rows, got %', v_expected, v_actual;
  end if;
end $$;

create index if not exists price_bands_field_day_idx
  on public.price_bands (field_id, weekday);
```

Then replace the two functions that read the column. **Append to the same migration file**, copying each body verbatim from its original migration and changing only the line shown:

- `public.calc_booking_price(uuid, tstzrange)` — copy the whole `create or replace function` block from `supabase/migrations/0005_price_bands.sql` and change one line inside the loop:

```sql
-- prima:
--      and dow = any(pb.weekdays)
-- dopo:
       and dow = pb.weekday
```

- `public.slot_prices(uuid, date, integer)` — copy the whole block from `supabase/migrations/0014_slot_prices.sql` and change one line:

```sql
-- prima:
--     and v_weekday = any(pb.weekdays);
-- dopo:
     and pb.weekday = v_weekday;
```

Copy the bodies rather than retyping them: both contain comments and guards that must survive intact.

- [ ] **Step 4: Update the seed and the five existing suites**

`supabase/seed.sql:18-27` becomes one row per weekday:

```sql
insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
select 'f0000000-0000-0000-0000-000000000001', f.id, d, w.s, w.e,
       case when f.kind = 'calcio7' then w.p + 1000 else w.p end
from public.fields f
cross join (values
  ('{1,2,3,4,5}'::smallint[], 900::smallint, 1140::smallint, 2000),
  ('{1,2,3,4,5}'::smallint[], 1140::smallint, 1440::smallint, 2500),
  ('{6,7}'::smallint[], 540::smallint, 1440::smallint, 2800)
) as w(days, s, e, p)
cross join lateral unnest(w.days) as d
where f.facility_id = 'f0000000-0000-0000-0000-000000000001';
```

In each of `003_price.test.sql`, `004_booking_overlap.test.sql`, `006_recurrences.test.sql`, `007_rpc_authorization.test.sql`, `009_slot_prices.test.sql`, the fixtures insert a band covering every weekday, like:

```sql
insert into public.price_bands (facility_id, field_id, weekdays, starts_min, ends_min, price_cents)
  values ('…','…', '{1,2,3,4,5,6,7}', 0, 1440, 2500);
```

Rewrite each as seven rows, keeping the same UUIDs, hours and prices:

```sql
insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
select '…', '…', d, 0, 1440, 2500 from generate_series(1, 7) as d;
```

Where a fixture uses a narrower set of days, list exactly those days in the `generate_series` replacement — for example `from unnest(array[1,2,3,4,5]) as d`. Do not change any hour, price or UUID: these suites assert exact amounts.

`003_price.test.sql` is the price oracle for this migration, and it is why no separate parity test is needed. It already pins `calc_booking_price` at 37,50 € inside one band, 45,00 € across two, 28,00 € on the weekend band, and a slot on the day the clocks change. Rewriting its fixture from three array rows to the same bands one weekday at a time, and watching those four amounts still come out, **is** the proof that the migration moved no price. If any of them shifts, the migration is wrong — do not adjust the expected value.

- [ ] **Step 5: Run the whole database suite**

Run: `npm run db:reset && npm run test:db`
Expected: PASS — the five existing suites unchanged in count, plus 5 new assertions from `012_price_band_overlap.test.sql`. Total 69.

If `db:reset` aborts inside migration 0018 with `23P01`, the seed contains overlapping bands: fix the seed, do not weaken the constraint.

- [ ] **Step 6: Regenerate types and typecheck**

Run: `npm run types && npx tsc -b`
Expected: `database.types.ts` shows `weekday: number` on `price_bands`; `tsc -b` exits 0. No client code reads `price_bands` directly — the customer app goes through `slot_prices` — so nothing else should need changing. If `tsc -b` reports an error, fix the call site rather than the generated file.

- [ ] **Step 7: Run the unit suite and commit**

Run: `npm run test`
Expected: PASS, 104 tests, unchanged.

```bash
git add supabase/migrations/0018_price_band_weekday.sql supabase/tests/012_price_band_overlap.test.sql \
        supabase/seed.sql supabase/tests/003_price.test.sql supabase/tests/004_booking_overlap.test.sql \
        supabase/tests/006_recurrences.test.sql supabase/tests/007_rpc_authorization.test.sql \
        supabase/tests/009_slot_prices.test.sql src/shared/lib/database.types.ts
git commit -m "fix(db): one weekday per price band, and overlaps become impossible"
```

---

### Task 2: `create_closure` — closing and cancelling in one transaction

Spec §2.4. The closure and the cancellations must both happen or neither, and a club closure must not damage anyone's reliability.

**Files:**
- Create: `supabase/migrations/0019_create_closure.sql`
- Create: `supabase/tests/013_create_closure.test.sql`
- Modify: `src/shared/lib/database.types.ts` — regenerated

**Interfaces:**
- Consumes: `public.is_facility_admin(uuid)` from migration 0002.
- Produces: `public.create_closure(p_facility_id uuid, p_field_id uuid, p_period tstzrange, p_reason text) returns integer` — the number of bookings cancelled. `p_field_id` null means the whole club. Task 7 calls it through `supabase.rpc('create_closure', …)`.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/013_create_closure.test.sql`. Follow the impersonation pattern of `007_rpc_authorization.test.sql`: insert fixtures as the owner, then `set local role authenticated;` with `request.jwt.claims`, and `reset role;` before `finish()`.

```sql
begin;
select plan(7);

insert into public.facilities (id, slug, name, booking_horizon_days)
  values ('d0000000-0000-0000-0000-0000000000c1', 'test-clo', 'Test Chiusure', 3650);
insert into public.fields (id, facility_id, name, kind) values
  ('d0000000-0000-0000-0000-0000000000c2','d0000000-0000-0000-0000-0000000000c1','Campo 1','calcio5'),
  ('d0000000-0000-0000-0000-0000000000c3','d0000000-0000-0000-0000-0000000000c1','Campo 2','calcio5');
insert into public.price_bands (facility_id, field_id, weekday, starts_min, ends_min, price_cents)
select 'd0000000-0000-0000-0000-0000000000c1', f.id, d, 0, 1440, 2500
  from public.fields f cross join generate_series(1,7) as d
 where f.facility_id = 'd0000000-0000-0000-0000-0000000000c1';

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-0000000000ca',
   'authenticated','authenticated','390000000101', now(), '','','','', now(), now()),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-0000000000cb',
   'authenticated','authenticated','390000000102', now(), '','','','', now(), now());

insert into public.facility_admins (facility_id, user_id)
  values ('d0000000-0000-0000-0000-0000000000c1','d0000000-0000-0000-0000-0000000000ca');

insert into public.members (id, facility_id, name, honored_count, missed_count)
  values ('d0000000-0000-0000-0000-0000000000cm','d0000000-0000-0000-0000-0000000000c1',
          'Cliente', 4, 1);

-- tre prenotazioni: una dentro il periodo sul campo che si chiude, una dentro
-- ma su un altro campo, una gia' disdetta
insert into public.bookings (id, facility_id, field_id, member_id, slot, status, price_cents, cancel_deadline)
values
  ('d0000000-0000-0000-0000-0000000000b1','d0000000-0000-0000-0000-0000000000c1',
   'd0000000-0000-0000-0000-0000000000c2','d0000000-0000-0000-0000-0000000000cm',
   tstzrange(now() + interval '2 days', now() + interval '2 days 1 hour'),
   'active', 2500, now() + interval '1 day'),
  ('d0000000-0000-0000-0000-0000000000b2','d0000000-0000-0000-0000-0000000000c1',
   'd0000000-0000-0000-0000-0000000000c3','d0000000-0000-0000-0000-0000000000cm',
   tstzrange(now() + interval '2 days', now() + interval '2 days 1 hour'),
   'active', 2500, now() + interval '1 day'),
  ('d0000000-0000-0000-0000-0000000000b3','d0000000-0000-0000-0000-0000000000c1',
   'd0000000-0000-0000-0000-0000000000c2','d0000000-0000-0000-0000-0000000000cm',
   tstzrange(now() + interval '2 days 2 hours', now() + interval '2 days 3 hours'),
   'cancelled', 2500, now() + interval '1 day');

set local role authenticated;

-- chi non e' amministratore non chiude niente
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-0000000000cb","role":"authenticated"}';
select throws_ok(
  $$select public.create_closure('d0000000-0000-0000-0000-0000000000c1',
      'd0000000-0000-0000-0000-0000000000c2',
      tstzrange(now() + interval '2 days', now() + interval '2 days 4 hours'), 'prova')$$,
  'PS016', null, 'un non amministratore non puo creare una chiusura');

select is((select status from public.bookings where id = 'd0000000-0000-0000-0000-0000000000b1'),
  'active', 'e la prenotazione e ancora attiva');

-- l'amministratore chiude, e disdice solo cio' che va disdetto
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-0000000000ca","role":"authenticated"}';
select is(
  public.create_closure('d0000000-0000-0000-0000-0000000000c1',
    'd0000000-0000-0000-0000-0000000000c2',
    tstzrange(now() + interval '2 days', now() + interval '2 days 4 hours'), 'tubo rotto'),
  1,
  'disdice la sola prenotazione attiva del campo chiuso');

select is((select status from public.bookings where id = 'd0000000-0000-0000-0000-0000000000b1'),
  'cancelled', 'quella dentro il periodo e disdetta');
select is((select status from public.bookings where id = 'd0000000-0000-0000-0000-0000000000b2'),
  'active', 'quella di un altro campo resta attiva');

-- ha chiuso il gestore: l'affidabilita' del cliente non c'entra
select results_eq(
  $$select honored_count, missed_count from public.members
     where id = 'd0000000-0000-0000-0000-0000000000cm'$$,
  $$values (4, 1)$$,
  'i contatori del cliente non si toccano');

select is((select count(*)::int from public.closures
            where facility_id = 'd0000000-0000-0000-0000-0000000000c1'),
  1, 'la chiusura e stata scritta');

reset role;
select * from finish();
rollback;
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:db`
Expected: FAIL — `function public.create_closure(…) does not exist`.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0019_create_closure.sql`:

```sql
-- Chiudere e' un evento, non l'invio di un modulo: quando dentro il periodo
-- ci sono gia' prenotazioni, o si chiude e si disdice insieme o non si fa
-- niente. Lasciarle attive significherebbe mandare un cliente davanti a un
-- cancello chiuso con in mano una prenotazione che il sistema chiama valida.
--
-- Percio' una funzione, e non due scritture dal client: `bookings` e'
-- scrivibile solo da RPC, e le due scritture devono stare in una transazione.
--
--   PS016 chi chiama non amministra questa struttura
--
-- L'anteprima dei conflitti resta invece una `select` normale dal pannello:
-- il gestore le sue prenotazioni le puo' gia' leggere via RLS, e solo la
-- scrittura ha bisogno di privilegi.
create or replace function public.create_closure(
  p_facility_id uuid,
  p_field_id uuid,      -- null = tutto l'impianto
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
  -- Autorizza prima di agire. `security definer` esegue e basta: se la
  -- verifica non e' qui, non c'e'.
  if not public.is_facility_admin(p_facility_id) then
    raise exception 'Non puoi modificare questa struttura.' using errcode = 'PS016';
  end if;

  if p_period is null or isempty(p_period) then
    raise exception 'Periodo non valido.' using errcode = 'PS001';
  end if;

  -- Un campo di un'altra struttura non si chiude da qui, e nemmeno per errore.
  if p_field_id is not null and not exists (
    select 1 from public.fields f
     where f.id = p_field_id and f.facility_id = p_facility_id
  ) then
    raise exception 'Campo non trovato.' using errcode = 'PS002';
  end if;

  insert into public.closures (facility_id, field_id, period, reason)
  values (p_facility_id, p_field_id, p_period, nullif(btrim(p_reason), ''));

  -- Si scrive `cancelled` direttamente invece di chiamare `cancel_booking`:
  -- quella incrementa `missed_count` oltre il termine, che e' giusto quando
  -- e' il giocatore a tirarsi indietro e sbagliato quando e' il gestore a
  -- chiudere. Qui non si tocca nessun contatore.
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
```

- [ ] **Step 4: Run the database suite**

Run: `npm run db:reset && npm run test:db`
Expected: PASS — 76 tests (69 after Task 1, plus 7).

- [ ] **Step 5: Regenerate types and commit**

Run: `npm run types && npx tsc -b`

```bash
git add supabase/migrations/0019_create_closure.sql supabase/tests/013_create_closure.test.sql src/shared/lib/database.types.ts
git commit -m "feat(db): create_closure closes and cancels in one transaction"
```

---

### Task 3: The settings shell, and the club's own screen

The tab bar that joins the four routes, plus the simplest of them so the shell ships with something real inside it. Spec §3 and §5.4.

**Files:**
- Create: `src/features/admin/components/SettingsTabs.tsx`
- Create: `src/features/admin/components/SettingsTabs.test.tsx`
- Create: `src/features/admin/components/SettingsPage.tsx`
- Create: `src/features/admin/components/FacilityPage.tsx`
- Create: `src/features/admin/hooks/useUpdateFacility.ts`
- Modify: `src/App.tsx:40-50` — four new routes inside the existing `RequireAdmin`
- Modify: `src/features/admin/components/AdminPage.tsx:28-40` — a link to the settings from the day grid toolbar

**Interfaces:**
- Consumes: `useFacility()` from `@/shared/tenant/FacilityProvider`, which returns the `Facility` type including `cancel_hours`, `booking_horizon_days`, `slot_minutes`, `min_duration_minutes`, `color`, `phone`, `address`.
- Produces:
  - `SettingsTabs()` — renders the four links, marking the current one with `aria-current="page"`.
  - `SettingsPage({ title, children }: { title: string; children: ReactNode })` — the shell every settings screen sits in. Tasks 4, 6 and 7 use it and define no page chrome of their own.
  - `useUpdateFacility(): { save(patch: Partial<Facility>): Promise<void>, isPending: boolean, error: Error | null }`.
  - Routes `/admin/campi`, `/admin/tariffe`, `/admin/chiusure`, `/admin/struttura`.

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/components/SettingsTabs.test.tsx`, modelled on `src/shared/components/ui/MobileTabBar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SettingsTabs } from './SettingsTabs'

function renderAt(pathname: string) {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <SettingsTabs />
    </MemoryRouter>,
  )
}

describe('SettingsTabs', () => {
  it('marks the tab of the current route, and only that one', () => {
    renderAt('/admin/tariffe')

    expect(screen.getByRole('link', { name: 'Tariffe' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getAllByRole('link').filter((l) => l.getAttribute('aria-current')))
      .toHaveLength(1)
  })

  it('offers the four sections and a way back to the day grid', () => {
    renderAt('/admin/campi')

    expect(screen.getByRole('link', { name: 'Campi' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Tariffe' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Chiusure' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Struttura' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Giornata' })).toHaveAttribute('href', '/admin')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- src/features/admin/components/SettingsTabs.test.tsx`
Expected: FAIL — cannot resolve `./SettingsTabs`.

- [ ] **Step 3: Write `SettingsTabs`**

```tsx
import { Link, useLocation } from 'react-router-dom'

const TABS = [
  { to: '/admin/campi', label: 'Campi' },
  { to: '/admin/tariffe', label: 'Tariffe' },
  { to: '/admin/chiusure', label: 'Chiusure' },
  { to: '/admin/struttura', label: 'Struttura' },
]

/**
 * The settings sections. The day grid link comes first and is not a tab: it
 * leaves this area rather than moving inside it, and a manager who came here
 * to change one price needs the way back to be obvious.
 */
export function SettingsTabs() {
  const { pathname } = useLocation()

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Link
        to="/admin"
        className="rounded-lg border border-line bg-surface px-3 py-1.5 text-[13px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
      >
        ‹ Giornata
      </Link>
      <span aria-hidden className="mx-1 h-5 w-px bg-line" />
      {TABS.map((tab) => {
        const active = pathname === tab.to
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={
              'rounded-lg border px-3 py-1.5 text-[13px] transition-colors ' +
              (active
                ? 'border-pitch bg-pitch-tint font-medium text-pitch'
                : 'border-line bg-surface text-ink-2 hover:border-pitch hover:text-pitch')
            }
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/admin/components/SettingsTabs.test.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Write the page shell**

Create `src/features/admin/components/SettingsPage.tsx`. All four screens sit in
it, so the chrome is written once and a later screen cannot drift from the
others:

```tsx
import type { ReactNode } from 'react'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { SettingsTabs } from './SettingsTabs'

/**
 * The frame shared by the four settings screens. It repeats the shell the day
 * grid uses (`AdminPage.tsx:20-27`) rather than importing it: the grid is one
 * page with its own toolbar, and pulling a shared layout out of it would be a
 * refactor this work does not need.
 */
export function SettingsPage({ title, children }: {
  title: string
  children: ReactNode
}) {
  const facility = useFacility()

  return (
    <div className="min-h-screen bg-ground p-4 sm:p-6">
      <div className="mx-auto max-w-[1140px]">
        <SettingsTabs />

        <p className="mt-5 text-[11px] uppercase tracking-[.14em] text-pitch">
          {facility.name}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-.02em]">{title}</h1>

        <div className="mt-4 flex flex-col gap-4">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Write the facility hook**

Create `src/features/admin/hooks/useUpdateFacility.ts`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility, type Facility } from '@/shared/tenant/FacilityProvider'

export type FacilityPatch = Partial<Pick<Facility,
  'name' | 'color' | 'phone' | 'address' |
  'cancel_hours' | 'booking_horizon_days' | 'slot_minutes' | 'min_duration_minutes'>>

/**
 * Writes straight to `facilities`: the `facilities_write_admin` policy is the
 * authorization, and putting a function in front of it would only move the
 * same check somewhere less reliable.
 */
export function useUpdateFacility() {
  const facility = useFacility()
  const qc = useQueryClient()

  const m = useMutation({
    mutationFn: async (patch: FacilityPatch) => {
      const { error } = await supabase
        .from('facilities')
        .update(patch)
        .eq('id', facility.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facility'] }),
  })

  return { save: m.mutateAsync, isPending: m.isPending, error: m.error }
}
```

If `Facility` is not exported from `FacilityProvider`, export the existing `type Facility` there — it is already declared, only the `export` keyword may be missing.

- [ ] **Step 7: Write `FacilityPage`**

Create `src/features/admin/components/FacilityPage.tsx`: `<SettingsPage title="Struttura">` wrapping a single form with two sections — identity and booking rules — saved with one button. Requirements, in Italian on screen:

- fields: `name` (required), `color` (an `<input type="color">`), `phone`, `address`;
- rules: `cancel_hours` (number, ≥ 0), `booking_horizon_days` (number, > 0), `slot_minutes` (a `<select>` with exactly 15, 30, 60 — the check constraint allows no others), `min_duration_minutes` (number, > 0);
- on save, show a `toast.success('Impostazioni salvate.')` using `sonner`, already a dependency and already used in `BookingPage.tsx`;
- on failure, render `<ErrorNote message="Non siamo riusciti a salvare le impostazioni. Riprova." />` from `@/shared/components/ui/ErrorNote`;
- while `isPending`, the save button is `disabled` — the global rule in `src/index.css` already greys it and sets `not-allowed`.

The colour input writes `color`, and `FacilityProvider` already pushes that value into `--brand` on every render of the provider, from which `index.css` derives the accent for both schemes. **Do not write `--pitch` from here** — that is the bug phase 1B had to undo.

- [ ] **Step 8: Wire the routes**

In `src/App.tsx`, beside the existing `/admin` route, inside the same `RequireAdmin`:

```tsx
const FacilityPage = lazy(() =>
  import('@/features/admin/components/FacilityPage').then((m) => ({ default: m.FacilityPage })))
```

```tsx
<Route path="/admin/struttura" element={<RequireAdmin><FacilityPage /></RequireAdmin>} />
```

Add the other three routes in Tasks 4, 6 and 7 as their pages appear.

In `src/features/admin/components/AdminPage.tsx`, add a link to `/admin/struttura` in the toolbar row that already holds the day navigation (around line 33, the `ml-auto` group), labelled «Impostazioni», styled like the other secondary controls there.

- [ ] **Step 9: Verify in the browser**

Run: `npm run dev`
Open `http://localhost:5174/admin/struttura` as the manager (`347 220 15 63`, code `472839`). Change the colour and save; the accent moves on both themes. Reload and confirm it stuck.

- [ ] **Step 10: Run everything and commit**

Run: `npx tsc -b && npm run test && npm run lint`
Expected: PASS, 106 tests.

```bash
git add src/features/admin/components/SettingsTabs.tsx src/features/admin/components/SettingsTabs.test.tsx \
        src/features/admin/components/SettingsPage.tsx src/features/admin/components/FacilityPage.tsx src/features/admin/hooks/useUpdateFacility.ts src/App.tsx \
        src/features/admin/components/AdminPage.tsx src/shared/tenant/FacilityProvider.tsx
git commit -m "feat(admin): settings shell and the club's own screen"
```

---

### Task 4: Pitches

Spec §5.1. The constraint that shapes the screen: `bookings.field_id` is `on delete restrict`, so a pitch that has ever been booked can never be deleted.

**Files:**
- Create: `src/features/admin/components/FieldsPage.tsx`
- Create: `src/features/admin/hooks/useAdminFields.ts`
- Create: `src/features/admin/utils/fieldMessages.ts`
- Create: `src/features/admin/utils/fieldMessages.test.ts`
- Modify: `src/App.tsx` — add the `/admin/campi` route

**Interfaces:**
- Consumes: `SettingsTabs` from Task 3.
- Produces:
  - `useAdminFields(): { fields: AdminField[], isPending, error, create, update, remove }` where `AdminField = { id, name, kind, surface, covered, active, sort_order, booking_count }`.
  - `messageForFieldWrite(error: unknown): string` in `fieldMessages.ts`.

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/utils/fieldMessages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { messageForFieldWrite } from './fieldMessages'

describe('messageForFieldWrite', () => {
  it('explains that a booked pitch is deactivated, not deleted', () => {
    // 23503 is the foreign key violation Postgres raises for
    // bookings.field_id, which is `on delete restrict`.
    expect(messageForFieldWrite({ code: '23503' }))
      .toBe('Questo campo ha prenotazioni: puoi disattivarlo, non eliminarlo.')
  })

  it('says plainly when the write was refused', () => {
    expect(messageForFieldWrite({ code: '42501' }))
      .toBe('Non hai i permessi per modificare questa struttura.')
  })

  it('falls back without inventing a cause', () => {
    expect(messageForFieldWrite({ code: 'XX000' }))
      .toBe('Non siamo riusciti a salvare il campo. Riprova.')
    expect(messageForFieldWrite(null))
      .toBe('Non siamo riusciti a salvare il campo. Riprova.')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- src/features/admin/utils/fieldMessages.test.ts`
Expected: FAIL — cannot resolve `./fieldMessages`.

- [ ] **Step 3: Write the messages**

```ts
/**
 * Postgres error codes turned into something a manager can act on. The
 * interesting one is 23503: `bookings.field_id` is `on delete restrict`, so a
 * pitch that has ever been booked cannot be deleted — and the manager needs
 * to be told what to do instead, not shown a foreign key violation.
 */
export function messageForFieldWrite(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code === '23503') {
    return 'Questo campo ha prenotazioni: puoi disattivarlo, non eliminarlo.'
  }
  if (code === '42501') {
    return 'Non hai i permessi per modificare questa struttura.'
  }
  return 'Non siamo riusciti a salvare il campo. Riprova.'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/admin/utils/fieldMessages.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the hook**

Create `src/features/admin/hooks/useAdminFields.ts`. It differs from `@/shared/hooks/useFields` in two ways that matter, and the file comment should say so: it returns **inactive pitches too**, and it carries `surface`, `active` and a booking count, because this screen has to decide whether deleting is even offered.

```ts
export type AdminField = {
  id: string
  name: string
  kind: string
  surface: string
  covered: boolean
  active: boolean
  sort_order: number
  booking_count: number
}
```

Query:

```ts
const { data, error } = await supabase
  .from('fields')
  .select('id, name, kind, surface, covered, active, sort_order, bookings(count)')
  .eq('facility_id', facility.id)
  .order('sort_order')
```

PostgREST returns `bookings: [{ count: n }]`; map it to `booking_count: r.bookings?.[0]?.count ?? 0`.

Expose three mutations, each invalidating both `['admin-fields', facility.id]` and `['fields', facility.id]` — the second is the customer-facing query, which must not keep showing a pitch that was just deactivated:

- `create(input: Omit<AdminField, 'id' | 'booking_count'>)` — `insert` with `facility_id`;
- `update(id: string, patch: Partial<AdminField>)` — `update … eq('id', id)`;
- `remove(id: string)` — `delete … eq('id', id)`, whose `23503` failure is expected and handled, not prevented.

- [ ] **Step 6: Write `FieldsPage`**

Create `src/features/admin/components/FieldsPage.tsx`: `<SettingsPage title="Campi">` from Task 3. Requirements:

- a row per pitch: name, `fieldKind(kind)` from `@/features/booking/utils/fieldKind`, surface, covered, and a badge «disattivato» when `active` is false;
- **reordering** with ▲/▼ buttons that swap `sort_order` with the neighbour, one `update` each. Drag-and-drop is not in this round;
- «Aggiungi campo» opens the same form used for editing — name, kind (`calcio5`/`calcio7`/`calcio11`), surface, covered — reusing `Dialog` from `@/shared/components/ui/Dialog`;
- an «Attivo» switch per pitch. Turning it off when `booking_count > 0` first shows, inside the dialog: «Questo campo ha N prenotazioni: resteranno valide. Per chiudere davvero il campo usa le Chiusure.» with a link to `/admin/chiusure`. It is a warning, not a second cancel flow;
- «Elimina» is rendered **only** when `booking_count === 0`. When the delete still fails — a booking created between the read and the click — show `messageForFieldWrite(error)` rather than a raw error;
- empty state: «Nessun campo. Aggiungine uno per cominciare a prendere prenotazioni.»

- [ ] **Step 7: Add the route and verify in the browser**

Add `/admin/campi` to `src/App.tsx` exactly as `/admin/struttura` was added in Task 3.

Run: `npm run dev`, open `/admin/campi` as the manager. Add a fourth pitch, reorder it, deactivate it, then confirm on `/prenota` that the customer no longer sees it. Try to delete `Campo 1` (it has bookings from the seed) and read the message.

- [ ] **Step 8: Run everything and commit**

Run: `npx tsc -b && npm run test && npm run lint`
Expected: PASS, 109 tests.

```bash
git add src/features/admin/components/FieldsPage.tsx src/features/admin/hooks/useAdminFields.ts \
        src/features/admin/utils/fieldMessages.ts src/features/admin/utils/fieldMessages.test.ts src/App.tsx
git commit -m "feat(admin): manage pitches, and say why a booked one cannot be deleted"
```

---

### Task 5: The day as segments — the piece the prices screen stands on

Spec §2.1 and §5.2. A gap must read as closed, and that reading is computed here, in a pure function, so it can be proved without a browser.

**Files:**
- Create: `src/features/admin/utils/daySegments.ts`
- Create: `src/features/admin/utils/daySegments.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export type Band = {
  id: string
  weekday: number      // 1..7, isodow: 1 = lunedì
  startsMin: number
  endsMin: number
  priceCents: number
}

export type Segment =
  | { kind: 'open'; fromMin: number; toMin: number; priceCents: number; bandId: string }
  | { kind: 'closed'; fromMin: number; toMin: number }

export function daySegments(bands: Band[], weekday: number): Segment[]
```

Task 6 renders exactly this and nothing else.

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/utils/daySegments.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { daySegments, type Band } from './daySegments'

const band = (over: Partial<Band> = {}): Band => ({
  id: 'b1', weekday: 1, startsMin: 540, endsMin: 1140, priceCents: 2000, ...over,
})

describe('daySegments', () => {
  it('a day with no bands is closed from midnight to midnight', () => {
    expect(daySegments([], 1)).toEqual([{ kind: 'closed', fromMin: 0, toMin: 1440 }])
  })

  it('surrounds a band with the closed stretches around it', () => {
    expect(daySegments([band()], 1)).toEqual([
      { kind: 'closed', fromMin: 0, toMin: 540 },
      { kind: 'open', fromMin: 540, toMin: 1140, priceCents: 2000, bandId: 'b1' },
      { kind: 'closed', fromMin: 1140, toMin: 1440 },
    ])
  })

  it('ignores the bands of other weekdays', () => {
    const other = band({ id: 'b2', weekday: 2, startsMin: 0, endsMin: 1440 })
    expect(daySegments([band(), other], 1)).toEqual([
      { kind: 'closed', fromMin: 0, toMin: 540 },
      { kind: 'open', fromMin: 540, toMin: 1140, priceCents: 2000, bandId: 'b1' },
      { kind: 'closed', fromMin: 1140, toMin: 1440 },
    ])
  })

  it('a band covering the whole day leaves no closed stretch', () => {
    const all = band({ startsMin: 0, endsMin: 1440 })
    expect(daySegments([all], 1)).toEqual([
      { kind: 'open', fromMin: 0, toMin: 1440, priceCents: 2000, bandId: 'b1' },
    ])
  })

  it('keeps two touching bands apart even at the same price', () => {
    // They are two rows, two prices a manager can change independently, and
    // drawing them as one would hide the seam where an edit lands.
    const a = band({ id: 'a', startsMin: 540, endsMin: 1140 })
    const b = band({ id: 'b', startsMin: 1140, endsMin: 1440 })
    expect(daySegments([a, b], 1)).toEqual([
      { kind: 'closed', fromMin: 0, toMin: 540 },
      { kind: 'open', fromMin: 540, toMin: 1140, priceCents: 2000, bandId: 'a' },
      { kind: 'open', fromMin: 1140, toMin: 1440, priceCents: 2000, bandId: 'b' },
    ])
  })

  it('shows the gap between two bands that do not touch', () => {
    const morning = band({ id: 'a', startsMin: 540, endsMin: 720 })
    const evening = band({ id: 'b', startsMin: 1080, endsMin: 1440 })
    expect(daySegments([evening, morning], 1)).toEqual([
      { kind: 'closed', fromMin: 0, toMin: 540 },
      { kind: 'open', fromMin: 540, toMin: 720, priceCents: 2000, bandId: 'a' },
      { kind: 'closed', fromMin: 720, toMin: 1080 },
      { kind: 'open', fromMin: 1080, toMin: 1440, priceCents: 2000, bandId: 'b' },
    ])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- src/features/admin/utils/daySegments.test.ts`
Expected: FAIL — cannot resolve `./daySegments`.

- [ ] **Step 3: Write the implementation**

```ts
const DAY_MIN = 1440

export type Band = {
  id: string
  weekday: number
  startsMin: number
  endsMin: number
  priceCents: number
}

export type Segment =
  | { kind: 'open'; fromMin: number; toMin: number; priceCents: number; bandId: string }
  | { kind: 'closed'; fromMin: number; toMin: number }

/**
 * One weekday of a pitch, from midnight to midnight, with the closed
 * stretches made explicit instead of left as holes.
 *
 * Price bands *are* the opening hours: a minute no band covers is a minute
 * `calc_booking_price` refuses with PS005. That rule is invisible in a table
 * of rows and obvious in a timeline, which is why this function returns the
 * closed stretches as segments of their own rather than expecting the caller
 * to notice the gaps between bands.
 *
 * Two touching bands stay two segments even at the same price: they are two
 * rows a manager edits separately, and merging them would hide the seam.
 * Overlaps cannot occur — `price_bands_no_overlap` forbids them in the
 * database — so the sort is enough to walk the day in order.
 */
export function daySegments(bands: Band[], weekday: number): Segment[] {
  const day = bands
    .filter((b) => b.weekday === weekday)
    .sort((a, b) => a.startsMin - b.startsMin)

  const out: Segment[] = []
  let cursor = 0

  for (const b of day) {
    if (b.startsMin > cursor) {
      out.push({ kind: 'closed', fromMin: cursor, toMin: b.startsMin })
    }
    out.push({
      kind: 'open',
      fromMin: b.startsMin,
      toMin: b.endsMin,
      priceCents: b.priceCents,
      bandId: b.id,
    })
    cursor = b.endsMin
  }

  if (cursor < DAY_MIN) {
    out.push({ kind: 'closed', fromMin: cursor, toMin: DAY_MIN })
  }

  return out
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/admin/utils/daySegments.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/utils/daySegments.ts src/features/admin/utils/daySegments.test.ts
git commit -m "feat(admin): turn a day's price bands into segments, gaps included"
```

---

### Task 6: Price bands

Spec §5.2. The centrepiece: a pitch's week as seven timelines, where the gap is the closure and it shows.

**Files:**
- Create: `src/features/admin/components/PriceBandsPage.tsx`
- Create: `src/features/admin/components/DayTimeline.tsx`
- Create: `src/features/admin/components/BandDialog.tsx`
- Create: `src/features/admin/hooks/usePriceBands.ts`
- Create: `src/features/admin/utils/bandMessages.ts`
- Create: `src/features/admin/utils/bandMessages.test.ts`
- Modify: `src/App.tsx` — add the `/admin/tariffe` route

**Interfaces:**
- Consumes: `daySegments`, `Band`, `Segment` from Task 5; `useAdminFields` from Task 4.
- Produces: `usePriceBands(fieldId: string | null): { bands: Band[], isPending, error, saveBand, deleteBand }` where `saveBand(input: { id?: string; weekdays: number[]; startsMin: number; endsMin: number; priceCents: number })` writes **one row per weekday**.

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/utils/bandMessages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { messageForBandWrite } from './bandMessages'

describe('messageForBandWrite', () => {
  it('names the overlap for what it is', () => {
    // 23P01 is the exclusion violation from price_bands_no_overlap.
    expect(messageForBandWrite({ code: '23P01' }))
      .toBe('Questa fascia si sovrappone a una già impostata: correggi gli orari o modifica quella.')
  })

  it('explains an impossible time range', () => {
    expect(messageForBandWrite({ code: '23514' }))
      .toBe('Gli orari non sono validi: la fine deve venire dopo l’inizio.')
  })

  it('falls back without inventing a cause', () => {
    expect(messageForBandWrite({ code: 'XX000' }))
      .toBe('Non siamo riusciti a salvare la fascia. Riprova.')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- src/features/admin/utils/bandMessages.test.ts`
Expected: FAIL — cannot resolve `./bandMessages`.

- [ ] **Step 3: Write the messages**

```ts
/**
 * The two failures this form can actually produce, said in words a manager
 * can act on. `23P01` is `price_bands_no_overlap` — the constraint that makes
 * an ambiguous price impossible — and `23514` is the `ends_min > starts_min`
 * check.
 */
export function messageForBandWrite(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code === '23P01') {
    return 'Questa fascia si sovrappone a una già impostata: correggi gli orari o modifica quella.'
  }
  if (code === '23514') {
    return 'Gli orari non sono validi: la fine deve venire dopo l’inizio.'
  }
  return 'Non siamo riusciti a salvare la fascia. Riprova.'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- src/features/admin/utils/bandMessages.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Write the hook**

Create `src/features/admin/hooks/usePriceBands.ts`.

Read: `select('id, weekday, starts_min, ends_min, price_cents').eq('field_id', fieldId).order('weekday').order('starts_min')`, mapped to the `Band` shape of Task 5 (camelCase in TypeScript, snake_case in the database).

`saveBand` is the part that carries the design decision, and the file comment must say it: **the band is one idea in the form and several rows underneath**. For a new band, insert one row per ticked weekday. For an edit, delete the rows of that band's group and insert the new set, in that order, so the exclusion constraint does not fire against the rows being replaced.

Because a multi-row write is not atomic through PostgREST, an edit that fails partway can leave the week half-written. The constraint still guarantees no overlap exists — the failure mode is a missing band, which the timeline shows as closed, not a wrong price. Do not paper over it: on error, invalidate and refetch so the screen shows what is actually stored, then display `messageForBandWrite(error)`.

`deleteBand(bandIds: string[])` removes a whole group with `.in('id', bandIds)`.

Both mutations invalidate `['price-bands', fieldId]`.

- [ ] **Step 6: Write `DayTimeline`**

Create `src/features/admin/components/DayTimeline.tsx`: one weekday, rendered from `daySegments(bands, weekday)`.

- a flex row whose children have `flex-grow` proportional to `toMin - fromMin`, so the day is to scale;
- `open` segments: `bg-pitch-tint text-pitch border border-pitch`, showing `formatEuro(priceCents)` from `@/shared/lib/money`, clickable — the click opens `BandDialog` on that band;
- `closed` segments: `bg-surface-2 text-muted`, showing «chiuso» when the segment is wide enough to hold the word, nothing when it is not;
- the row is labelled with the weekday name from `date-fns/locale/it`, and hour marks at 00, 06, 12, 18 and 24 sit above the seven rows, once;
- each segment carries a `title` with the exact hours (`minToLabel` from `@/shared/lib/tz`), because at 400px wide a segment may be a few pixels;
- the whole strip is wrapped in `overflow-x-auto` with `min-w-[480px]` inside, the same pattern `DayGrid.tsx:35-38` already uses for a wide instrument on a narrow screen.

- [ ] **Step 7: Write `BandDialog` and `PriceBandsPage`**

`BandDialog` — built on `@/shared/components/ui/Dialog` — is the one form: seven weekday checkboxes, start and end as `<input type="time">` converted to minutes, price in euros converted to cents with the helpers in `@/shared/lib/money`, plus «Elimina» when editing an existing band. On save it calls `saveBand`; on failure it shows `messageForBandWrite(error)` inside the dialog and stays open with the values intact.

`PriceBandsPage` puts it together inside `<SettingsPage title="Tariffe">`: a pitch selector reusing the `FieldPicker` pattern from `BookPage.tsx:364-396` (copy it, do not import it — a feature must not import another feature's components), the seven `DayTimeline` rows for the selected pitch, and «Aggiungi fascia».

The empty state is the one that matters: a pitch with no bands shows seven closed rows and, above them, «Questo campo non ha tariffe: è chiuso tutti i giorni. Aggiungi una fascia per aprirlo.» That sentence is the whole of spec §2.1 said out loud.

- [ ] **Step 8: Add the route and verify in the browser**

Add `/admin/tariffe` to `src/App.tsx`.

Run: `npm run dev`, open `/admin/tariffe`. Check, in this order: the seed week renders with 20 €, 25 € and the weekend band; adding a band overlapping an existing one shows the overlap message and changes nothing; adding a Monday-to-Friday band writes five rows and draws on five days; deleting a band opens a hole that reads «chiuso»; then open `/prenota` on that pitch and confirm the slots disappeared with it.

- [ ] **Step 9: Run everything and commit**

Run: `npx tsc -b && npm run test && npm run lint`
Expected: PASS, 118 tests.

```bash
git add src/features/admin/components/PriceBandsPage.tsx src/features/admin/components/DayTimeline.tsx \
        src/features/admin/components/BandDialog.tsx src/features/admin/hooks/usePriceBands.ts \
        src/features/admin/utils/bandMessages.ts src/features/admin/utils/bandMessages.test.ts src/App.tsx
git commit -m "feat(admin): a pitch's week as timelines, where a gap reads as closed"
```

---

### Task 7: Closures

Spec §2.4 and §5.3. The screen that turns a closure into the event it actually is.

**Files:**
- Create: `src/features/admin/components/ClosuresPage.tsx`
- Create: `src/features/admin/components/NewClosureDialog.tsx`
- Create: `src/features/admin/hooks/useClosures.ts`
- Create: `src/features/admin/hooks/useClosureConflicts.ts`
- Modify: `src/App.tsx` — add the `/admin/chiusure` route
- Modify: `docs/come-provare.md` — a new scenario 11

**Interfaces:**
- Consumes: `create_closure` from Task 2; `useAdminFields` from Task 4; `SettingsTabs` from Task 3.
- Produces: nothing later tasks rely on.

- [ ] **Step 1: Write the hooks**

`useClosures()` reads `closures` for the facility with the pitch name joined, split into upcoming (`upper(period) >= now()`) and past, each ordered by start. Expose `remove(id)` too: deleting a closure reopens the period.

`useClosureConflicts(fieldId: string | null, period: { from: Date; to: Date } | null)` is the preview, and it is a plain `select` — not an RPC — because a manager can already read their own bookings through RLS:

```ts
const { data, error } = await supabase
  .from('bookings')
  .select('id, slot, price_cents, field_id, members(name, phone)')
  .eq('facility_id', facility.id)
  .eq('status', 'active')
  .overlaps('slot', `[${from.toISOString()},${to.toISOString()})`)
```

adding `.eq('field_id', fieldId)` only when a pitch is chosen. Disabled (`enabled: !!period`) until there is a period to check.

- [ ] **Step 2: Write `NewClosureDialog`**

Two steps in one dialog, and the order is the point:

1. **the form** — pitch (a `<select>` whose first option is «Tutto l'impianto», mapping to `null`), start and end as `<input type="datetime-local">`, reason (optional, free text);
2. **the confirmation** — as soon as both instants are set, `useClosureConflicts` runs and the dialog shows what the closure would hit: for each booking, day and time, pitch, customer name **and phone number**, and the amount. Above the list: «Chiudendo, queste N prenotazioni verranno disdette.» Below it, and this is the sentence that must not be omitted: «I clienti non ricevono ancora un avviso: chiamali tu.» — notifications are the third sub-project, and pretending otherwise would leave customers uninformed without anyone realising.

With no conflicts the list is replaced by «Nessuna prenotazione in questo periodo.» and the button reads «Chiudi»; with conflicts it reads «Chiudi e disdici N prenotazioni».

Confirming calls:

```ts
const { data, error } = await supabase.rpc('create_closure', {
  p_facility_id: facility.id,
  p_field_id: fieldId,
  p_period: `[${from.toISOString()},${to.toISOString()})`,
  p_reason: reason,
})
```

On success: `toast.success(n === 0 ? 'Chiusura salvata.' : \`Chiusura salvata. Disdette ${n} prenotazioni.\`)`, close, and invalidate `['closures', facility.id]` **and** `['bookings', facility.id]` so the day grid stops showing what was just cancelled.

On `PS016`, show «Non hai i permessi per chiudere questo impianto.»; on anything else, «Non siamo riusciti a salvare la chiusura. Riprova.»

- [ ] **Step 3: Write `ClosuresPage`**

`<SettingsPage title="Chiusure">` holding «Aggiungi chiusura», then two sections — «Prossime» and «Passate» — each a list of rows showing pitch or «tutto l'impianto», the period formatted with `date-fns` and the `it` locale, and the reason.

Deleting an upcoming closure asks for confirmation and says what deletion does and does not do: «Il periodo torna prenotabile. Le prenotazioni già disdette non tornano indietro.»

Empty state: «Nessuna chiusura. L'impianto è aperto negli orari delle tariffe.» — which is also a reminder of where the hours really live.

- [ ] **Step 4: Add the route and verify in the browser**

Add `/admin/chiusure` to `src/App.tsx`.

Run: `npm run dev`. As the manager, close `Campo 1` for a period that contains a seeded booking. Check that the preview lists it with the customer's phone number, that confirming reports the count, that the booking shows as «Disdetta» in the customer's own `/prenotazioni`, and that `missed_count` did not move:

```bash
docker exec supabase_db_pitchside psql -U postgres -d postgres -c \
  "select name, honored_count, missed_count from public.members where phone = '3394128807';"
```

- [ ] **Step 5: Document the manual scenario**

Add to `docs/come-provare.md`, after scenario 10, a scenario 11 «Configurare l'impianto» walking through: add a fourth pitch, price it for the whole week, see it appear on `/prenota`, close it for a day that has a booking, and find that booking cancelled in the customer's history. Keep the file's voice — what to do, and what you must see.

- [ ] **Step 6: Run everything and commit**

Run: `npx tsc -b && npm run test && npm run test:db && npm run lint && npm run build`
Expected: PASS — 118 unit tests, 76 pgTAP, clean build.

```bash
git add src/features/admin/components/ClosuresPage.tsx src/features/admin/components/NewClosureDialog.tsx \
        src/features/admin/hooks/useClosures.ts src/features/admin/hooks/useClosureConflicts.ts \
        src/App.tsx docs/come-provare.md
git commit -m "feat(admin): closures that show what they cancel before they cancel it"
```

---

## Done when

- A club can be configured end to end without `psql`: pitches added and reordered, a week priced, a day closed, the booking rules changed.
- Overlapping price bands are impossible, not merely discouraged, and the migration that made them impossible proved it lost no price.
- Closing a pitch cancels what it covers in one transaction and damages nobody's reliability.
- `npm run test` (118), `npm run test:db` (76), `npx tsc -b`, `npm run lint` and `npm run build` all clean.

# Fase 1A — Fondamenta e prenotazioni · Piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Portare il gestore del Palacalcetto a gestire l'intera giornata di prenotazioni dal sistema invece che dal quaderno, con la garanzia che due prenotazioni non possano sovrapporsi.

**Architecture:** SPA React servita da Vite, backend Supabase. Tutta la logica che deve essere atomica (calcolo prezzo, creazione e disdetta prenotazione) vive in funzioni `plpgsql` chiamate via RPC, nella stessa transazione del vincolo di esclusione Postgres. Il frontend non compone mai una `insert` su `bookings`.

**Tech Stack:** React 18+ · TypeScript · Vite · Tailwind · shadcn/ui · TanStack Query · React Router · date-fns-tz · Supabase (Postgres, Auth OTP, Realtime) · pgTAP · Vitest · Playwright

**Spec:** `docs/superpowers/specs/2026-09-05-prenota-campi-design.md`

**Mockup di riferimento:** `docs/mockups/01-proposta-design.html` e `docs/mockups/02-catalogo-schermate.html`. Quando un task dice «markup come da mockup, sezione X», quello è un riferimento concreto a un file presente nel repository, non un segnaposto: il markup e le variabili CSS sono lì, vanno letti e portati nei componenti.

## Global Constraints

- **Fuso orario:** ogni istante è `timestamptz`. Il fuso di visualizzazione e di interpretazione delle fasce è `Europe/Rome`, dichiarato in una costante, mai dedotto dal client.
- **Orari come minuti:** le fasce orarie si esprimono in minuti da mezzanotte (`0..1440`), non come `time`. Motivo: `time '24:00'` non esiste, e la chiusura a mezzanotte è il caso normale di questo impianto.
- **Denaro in centesimi:** ogni importo è `integer` in centesimi. Mai `float`, mai `numeric` nelle colonne.
- **`user_id` è nullable ovunque.** Nessuna riga di dominio richiede un account.
- **`facility_id` su ogni tabella di dominio.** Nessuna query attraversa le strutture.
- **RLS attiva su ogni tabella**, senza eccezioni, con `alter table ... enable row level security` nella stessa migrazione che crea la tabella.
- **Nessuna scrittura diretta su `bookings` dal client.** Solo RPC.
- **Migrazioni versionate** in `supabase/migrations/`, mai modifiche a mano al database.
- **Lingua:** identificatori di codice in inglese, testo per l'utente e messaggi d'errore in italiano.

---

### Task 0: Gina Workflow

- [ ] **Step 1: Chiedere se finalizzare il piano**

Usa `AskUserQuestion` con header **"Gina Workflow - Finalize Claude Plan"** e la domanda: «Vuoi eseguire `/gina:finalize-claude-plan` prima di iniziare l'implementazione?»

Opzioni:
- `Yes, run /gina:finalize-claude-plan`
- `Skip`

Se **Yes**: esegui il comando `/gina:finalize-claude-plan`.
Se **Skip**: prosegui con il Task 1.

---

## Struttura dei file

```
supabase/
  config.toml
  migrations/
    0001_extensions.sql            estensioni: btree_gist, pgtap
    0002_facilities.sql            facilities, facility_domains, facility_admins, is_facility_admin()
    0003_fields.sql                fields
    0004_members.sql               members + ricerca per telefono
    0005_price_bands.sql           price_bands + calc_booking_price()
    0006_bookings.sql              bookings, closures, vincolo, create_booking(), cancel_booking()
    0007_busy_slots.sql            vista pubblica degli slot occupati
    0008_recurrences.sql           recurrences + generate_recurrence()
  tests/
    001_facilities_rls.test.sql
    002_members_rls.test.sql
    003_price.test.sql             include il caso ora legale
    004_booking_overlap.test.sql
    005_booking_rls.test.sql
    006_recurrences.test.sql
  seed.sql                         Palacalcetto, 3 campi, fasce, un admin

src/
  lib/
    supabase.ts                    client tipizzato, singleton
    database.types.ts              generato da `supabase gen types`
    tz.ts                          costante fuso + helper di conversione
    money.ts                       formattazione centesimi → euro
  tenant/
    resolveTenant.ts               hostname sul web, preferenza su nativo
    FacilityProvider.tsx           contesto struttura + branding via variabili CSS
  auth/
    AuthProvider.tsx               sessione Supabase
    RequireAdmin.tsx               guardia di rotta
    LoginPage.tsx                  OTP telefono
  admin/
    DayGrid.tsx                    griglia del giorno, sola lettura
    DayGrid.hooks.ts               query + sottoscrizione realtime
    BookingCell.tsx                blocco prenotazione
    NewBookingDialog.tsx           inserimento telefonata
    BookingDetailDialog.tsx        dettaglio, spostamento, disdetta
    RecurrenceForm.tsx             ricorrenza dentro NewBookingDialog
  components/ui/                   shadcn, generati
  App.tsx
  main.tsx
```

Ogni file ha una responsabilità sola. `DayGrid.tsx` disegna e basta; le query e la sottoscrizione realtime stanno in `DayGrid.hooks.ts`, così la griglia si può testare con dati finti.

---

### Task 1: Impalcatura del progetto

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/index.css`
- Create: `supabase/config.toml` (generato dalla CLI)
- Create: `.env.local.example`
- Create: `CLAUDE.md`

**Interfaces:**
- Produces: `npm run dev`, `npm run test`, `npm run test:db`, `npm run types`

- [ ] **Step 1: Creare il progetto Vite**

```bash
npm create vite@latest . -- --template react-ts
npm install
npm install @supabase/supabase-js @tanstack/react-query react-router-dom date-fns date-fns-tz
npm install sonner
npm install -D tailwindcss @tailwindcss/vite vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom
npx shadcn@latest init
npx shadcn@latest add dialog input button checkbox
```

- [ ] **Step 2: Configurare Tailwind con i token dei mockup**

Apri `docs/mockups/01-proposta-design.html` e copia i valori del blocco `:root` in `src/index.css`. I nomi restano identici, così i mockup si leggono come documentazione viva:

```css
@import "tailwindcss";

:root{
  --ground:#ECEFE9; --surface:#FFFFFF; --surface-2:#F5F7F2;
  --ink:#131A15; --ink-2:#3F4A42; --muted:#6E786C;
  --line:#D5DACE; --line-soft:#E3E7DE;
  --pitch:#146B3F; --pitch-tint:#DDEBE1;
  --terra:#A8431C; --terra-tint:#F3E3DA;
  --slate:#4F6285; --slate-tint:#DFE4EE;
  --ochre:#8A6510; --ochre-tint:#F0E7CF;
}
@media (prefers-color-scheme: dark){
  :root:not([data-theme="light"]){
    --ground:#0E120F; --surface:#161C18; --surface-2:#1C231E;
    --ink:#E7ECE5; --ink-2:#B4BDB2; --muted:#8A958A;
    --line:#2B332C; --line-soft:#222A24;
    --pitch:#4FB07A; --pitch-tint:#17301F;
    --terra:#E08B62; --terra-tint:#33201A;
    --slate:#93A6C9; --slate-tint:#1C2432;
    --ochre:#D7B25C; --ochre-tint:#2E2716;
  }
}
@theme inline{
  --color-ground: var(--ground);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-line-soft: var(--line-soft);
  --color-pitch: var(--pitch);
  --color-pitch-tint: var(--pitch-tint);
  --color-terra: var(--terra);
  --color-terra-tint: var(--terra-tint);
  --color-slate: var(--slate);
  --color-slate-tint: var(--slate-tint);
  --color-ochre: var(--ochre);
  --color-ochre-tint: var(--ochre-tint);
}
```

Le variabili restano CSS e non diventano valori compilati: è ciò che permette al branding per struttura di cambiarle a runtime.

- [ ] **Step 3: Inizializzare Supabase in locale**

```bash
npx supabase init
npx supabase start
```

Annota la `anon key` e la URL locale stampate a schermo; mettile in `.env.local`:

```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<la chiave stampata da supabase start>
```

Crea `.env.local.example` con le stesse chiavi e valori vuoti, e verifica che `.env.local` sia coperto dal `.gitignore`.

- [ ] **Step 4: Aggiungere gli script**

In `package.json`:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "test": "vitest run",
    "test:db": "supabase test db",
    "types": "supabase gen types typescript --local > src/lib/database.types.ts",
    "db:reset": "supabase db reset"
  }
}
```

- [ ] **Step 5: Verificare che l'impalcatura giri**

```bash
npm run dev
```
Atteso: la pagina di default Vite si apre senza errori in console.

```bash
npx supabase status
```
Atteso: tutti i servizi `RUNNING`.

- [ ] **Step 6: Scrivere `CLAUDE.md`**

```markdown
# Prenota Campi

Prenotazione campi da calcio, multi-struttura. Primo cliente: Palacalcetto, Alba.

## Documenti
- Specifica: `docs/superpowers/specs/2026-09-05-prenota-campi-design.md`
- Piano fase 1A: `docs/superpowers/plans/2026-09-05-fase-1a-prenotazioni.md`
- Mockup: `docs/mockups/` — due file HTML autonomi, aprili nel browser

## Regole che non si violano
- Ogni tabella di dominio ha `facility_id`. Nessuna query attraversa le strutture.
- `members.user_id` è nullable: cliente, giocatore e utente sono la stessa tabella.
- Le statistiche puntano a `member_id`, mai a `user_id`.
- Denaro in centesimi (`integer`). Orari delle fasce in minuti da mezzanotte (0..1440).
- Ogni istante è `timestamptz`. Fuso di riferimento `Europe/Rome`, dalla costante in `src/lib/tz.ts`.
- Creazione, spostamento e disdetta prenotazione passano **solo** dalle funzioni RPC.
  Nessuna `insert`/`update` diretta su `bookings` dal client.
- RLS attiva su ogni tabella, nella stessa migrazione che la crea.
- Le squadre nascono solo da un'iscrizione a un torneo (fase 2).

## Comandi
- `npm run dev` — frontend
- `npm run db:reset` — ricrea il database locale e applica seed
- `npm run test:db` — test pgTAP (regole di dominio e RLS)
- `npm run test` — test unitari
- `npm run types` — rigenera i tipi dopo ogni migrazione

## Convenzioni
- Identificatori in inglese, testo utente e messaggi d'errore in italiano.
- Un file, una responsabilità. Le query stanno in `*.hooks.ts`, non nei componenti.
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: impalcatura Vite, Tailwind e Supabase locale"
```

---

### Task 2: Struttura, campi e amministratori

**Files:**
- Create: `supabase/migrations/0001_extensions.sql`
- Create: `supabase/migrations/0002_facilities.sql`
- Create: `supabase/migrations/0003_fields.sql`
- Test: `supabase/tests/001_facilities_rls.test.sql`

**Interfaces:**
- Produces: tabelle `facilities`, `facility_domains`, `facility_admins`, `fields`; funzione `is_facility_admin(uuid) returns boolean`

- [ ] **Step 1: Scrivere il test che fallisce**

`supabase/tests/001_facilities_rls.test.sql`:

```sql
begin;
select plan(5);

select has_table('public', 'facilities', 'facilities esiste');
select has_table('public', 'fields', 'fields esiste');
select has_function('public', 'is_facility_admin', array['uuid'], 'is_facility_admin esiste');

-- RLS attiva
select is(relrowsecurity, true, 'RLS attiva su facilities')
  from pg_class where oid = 'public.facilities'::regclass;
select is(relrowsecurity, true, 'RLS attiva su fields')
  from pg_class where oid = 'public.fields'::regclass;

select * from finish();
rollback;
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test:db
```
Atteso: FAIL, `relation "public.facilities" does not exist`.

- [ ] **Step 3: Scrivere `0001_extensions.sql`**

```sql
create extension if not exists btree_gist;
create extension if not exists pgtap with schema extensions;
```

`btree_gist` serve perché il vincolo di esclusione del Task 5 confronta un `uuid` con `=` dentro un indice GiST: senza, il vincolo non si può creare.

- [ ] **Step 4: Scrivere `0002_facilities.sql`**

```sql
create table public.facilities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  color text not null default '#146B3F',
  phone text,
  address text,
  -- regole di prenotazione
  cancel_hours smallint not null default 24 check (cancel_hours >= 0),
  booking_horizon_days smallint not null default 60 check (booking_horizon_days > 0),
  slot_minutes smallint not null default 30 check (slot_minutes in (15, 30, 60)),
  min_duration_minutes smallint not null default 60 check (min_duration_minutes > 0),
  features jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.facility_domains (
  facility_id uuid not null references public.facilities(id) on delete cascade,
  hostname text primary key
);

create table public.facility_admins (
  facility_id uuid not null references public.facilities(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'staff' check (role in ('owner', 'staff')),
  primary key (facility_id, user_id)
);

-- Usata da tutte le policy. SECURITY DEFINER perché deve leggere
-- facility_admins anche quando la policy che la chiama non lo permetterebbe:
-- senza, la policy ricorrerebbe su sé stessa.
create or replace function public.is_facility_admin(p_facility uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.facility_admins fa
    where fa.facility_id = p_facility
      and fa.user_id = auth.uid()
  );
$$;

alter table public.facilities enable row level security;
alter table public.facility_domains enable row level security;
alter table public.facility_admins enable row level security;

-- La scheda della struttura è pubblica: la home la mostra senza login.
create policy facilities_read_all on public.facilities
  for select using (true);
create policy facilities_write_admin on public.facilities
  for update using (public.is_facility_admin(id));

create policy domains_read_all on public.facility_domains
  for select using (true);

create policy admins_read_self on public.facility_admins
  for select using (user_id = auth.uid());
```

- [ ] **Step 5: Scrivere `0003_fields.sql`**

```sql
create table public.fields (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('calcio5', 'calcio7', 'calcio11')),
  surface text not null default 'sintetico',
  covered boolean not null default false,
  active boolean not null default true,
  sort_order smallint not null default 0
);

create index fields_facility_idx on public.fields (facility_id, sort_order);

alter table public.fields enable row level security;

create policy fields_read_all on public.fields
  for select using (true);
create policy fields_write_admin on public.fields
  for all using (public.is_facility_admin(facility_id))
  with check (public.is_facility_admin(facility_id));
```

- [ ] **Step 6: Eseguire il test e verificare che passi**

```bash
npm run db:reset && npm run test:db
```
Atteso: `# All 5 tests passed`.

- [ ] **Step 7: Rigenerare i tipi e committare**

```bash
npm run types
git add -A
git commit -m "feat(db): struttura, domini, amministratori e campi con RLS"
```

---

### Task 3: Anagrafica unificata (`members`)

**Files:**
- Create: `supabase/migrations/0004_members.sql`
- Test: `supabase/tests/002_members_rls.test.sql`

**Interfaces:**
- Consumes: `is_facility_admin(uuid)` dal Task 2
- Produces: tabella `members`; funzione `find_members_by_phone(text) returns setof members`

- [ ] **Step 1: Scrivere il test che fallisce**

`supabase/tests/002_members_rls.test.sql`:

```sql
begin;
select plan(4);

select has_table('public', 'members', 'members esiste');
select col_is_null('public', 'members', 'user_id', 'user_id è nullable');

-- un membro senza account si può inserire
insert into public.facilities (id, slug, name)
  values ('11111111-1111-1111-1111-111111111111', 'test', 'Test');
select lives_ok(
  $$insert into public.members (facility_id, name, phone)
    values ('11111111-1111-1111-1111-111111111111', 'Rossi', '3472201563')$$,
  'un membro senza account si inserisce'
);

-- stesso telefono in due strutture: ammesso
insert into public.facilities (id, slug, name)
  values ('22222222-2222-2222-2222-222222222222', 'test2', 'Test 2');
select lives_ok(
  $$insert into public.members (facility_id, name, phone)
    values ('22222222-2222-2222-2222-222222222222', 'Rossi', '3472201563')$$,
  'lo stesso telefono esiste in due strutture'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test:db
```
Atteso: FAIL, `relation "public.members" does not exist`.

- [ ] **Step 3: Scrivere `0004_members.sql`**

```sql
create table public.members (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  -- nullable per scelta: copre chi telefona e chi viene aggiunto da un capitano
  user_id uuid references auth.users(id) on delete set null,
  name text not null check (length(trim(name)) > 0),
  phone text,
  email text,
  kind text not null default 'person' check (kind in ('person', 'group', 'team')),
  price_list text not null default 'standard',
  notes text,                       -- note interne: mai esposte al cliente
  honored_count integer not null default 0,
  missed_count integer not null default 0,
  created_at timestamptz not null default now()
);

-- Un telefono è unico dentro una struttura, non nel sistema:
-- la stessa persona può essere cliente di due impianti.
create unique index members_facility_phone_uniq
  on public.members (facility_id, phone) where phone is not null;
create unique index members_facility_user_uniq
  on public.members (facility_id, user_id) where user_id is not null;
create index members_name_trgm on public.members (facility_id, lower(name));

-- Affidabilità: percentuale di prenotazioni onorate. NULL finché non c'è storia,
-- perché "0%" per un cliente nuovo sarebbe una calunnia.
create or replace function public.member_reliability(m public.members)
returns integer
language sql
stable
as $$
  select case
    when m.honored_count + m.missed_count = 0 then null
    else round(100.0 * m.honored_count / (m.honored_count + m.missed_count))::integer
  end;
$$;

-- Cerca le schede associate a un numero, in ogni struttura.
-- Serve alla rivendicazione dopo la registrazione: il chiamante è l'utente
-- appena autenticato, quindi SECURITY DEFINER ma con filtro sul telefono.
create or replace function public.find_members_by_phone(p_phone text)
returns setof public.members
language sql
stable
security definer
set search_path = public
as $$
  select * from public.members
  where phone = p_phone and user_id is null;
$$;

alter table public.members enable row level security;

create policy members_read_own on public.members
  for select using (user_id = auth.uid());
create policy members_read_admin on public.members
  for select using (public.is_facility_admin(facility_id));
create policy members_write_admin on public.members
  for all using (public.is_facility_admin(facility_id))
  with check (public.is_facility_admin(facility_id));
```

`notes` è leggibile solo dalle policy admin: la policy `members_read_own` espone la riga anche all'utente, quindi il frontend cliente non deve mai selezionare quella colonna. Il Task 9 usa `select` con colonne esplicite proprio per questo.

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npm run db:reset && npm run test:db
```
Atteso: `# All 4 tests passed`.

- [ ] **Step 5: Commit**

```bash
npm run types
git add -A
git commit -m "feat(db): anagrafica unificata members con user_id nullable"
```

---

### Task 4: Fasce tariffarie e calcolo del prezzo

**Files:**
- Create: `supabase/migrations/0005_price_bands.sql`
- Test: `supabase/tests/003_price.test.sql`

**Interfaces:**
- Consumes: `fields`, `facilities` dal Task 2
- Produces: tabella `price_bands`; funzione `calc_booking_price(p_field_id uuid, p_slot tstzrange) returns integer` — centesimi

- [ ] **Step 1: Scrivere il test che fallisce**

`supabase/tests/003_price.test.sql`. I tre casi che contano: fascia singola, prenotazione a cavallo di due fasce, e il cambio dell'ora legale.

```sql
begin;
select plan(4);

insert into public.facilities (id, slug, name)
  values ('11111111-1111-1111-1111-111111111111', 'test', 'Test');
insert into public.fields (id, facility_id, name, kind)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Campo 1', 'calcio5');

-- feriale: 15:00–19:00 a 20 €/h, 19:00–24:00 a 25 €/h
insert into public.price_bands (facility_id, field_id, weekdays, starts_min, ends_min, price_cents)
values
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
   '{1,2,3,4,5}', 900, 1140, 2000),
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
   '{1,2,3,4,5}', 1140, 1440, 2500),
  ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
   '{6,7}', 540, 1440, 2800);

-- martedì 14 ottobre 2025, 20:00–21:30 → tutta in fascia serale: 1,5 × 25 = 37,50
select is(
  public.calc_booking_price('aaaaaaaa-0000-0000-0000-000000000001',
    tstzrange('2025-10-14 20:00+02','2025-10-14 21:30+02')),
  3750, 'una sola fascia: 37,50 euro'
);

-- martedì 14 ottobre, 18:00–20:00 → 1h a 20 + 1h a 25 = 45,00
select is(
  public.calc_booking_price('aaaaaaaa-0000-0000-0000-000000000001',
    tstzrange('2025-10-14 18:00+02','2025-10-14 20:00+02')),
  4500, 'a cavallo di due fasce: 45,00 euro'
);

-- sabato 18 ottobre, 10:00–11:00 → fascia weekend: 28,00
select is(
  public.calc_booking_price('aaaaaaaa-0000-0000-0000-000000000001',
    tstzrange('2025-10-18 10:00+02','2025-10-18 11:00+02')),
  2800, 'fascia del weekend'
);

-- Ora legale: domenica 26 ottobre 2025 l'ora torna indietro alle 03:00.
-- Uno slot serale delle 21:00 quel giorno è in fascia weekend e dura un'ora reale.
select is(
  public.calc_booking_price('aaaaaaaa-0000-0000-0000-000000000001',
    tstzrange('2025-10-26 21:00+01','2025-10-26 22:00+01')),
  2800, 'il giorno del cambio ora il prezzo resta corretto'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test:db
```
Atteso: FAIL, `relation "public.price_bands" does not exist`.

- [ ] **Step 3: Scrivere `0005_price_bands.sql`**

```sql
-- Gli orari sono minuti da mezzanotte (0..1440) e non `time`:
-- la chiusura a mezzanotte è il caso normale e `time '24:00'` non esiste.
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
-- vincolo di prodotto, coprono tutto l'orario in cui si può prenotare.
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
```

Il contatore `guard` non è difensivismo generico: se un giorno una fascia venisse salvata con `ends_min <= starts_min` aggirando il check, il ciclo non avanzerebbe. Meglio un errore leggibile che una query che non torna.

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npm run db:reset && npm run test:db
```
Atteso: `# All 4 tests passed`, incluso il caso dell'ora legale.

- [ ] **Step 5: Commit**

```bash
npm run types
git add -A
git commit -m "feat(db): fasce tariffarie per giorno e orario, con calcolo prezzo"
```

---

### Task 5: Prenotazioni, vincolo di esclusione e RPC

**Files:**
- Create: `supabase/migrations/0006_bookings.sql`
- Test: `supabase/tests/004_booking_overlap.test.sql`

**Interfaces:**
- Consumes: `calc_booking_price(uuid, tstzrange)` dal Task 4
- Produces: tabelle `bookings`, `closures`; funzioni `create_booking(p_field_id uuid, p_slot tstzrange, p_member_id uuid, p_source text) returns public.bookings` e `cancel_booking(p_booking_id uuid, p_reason text) returns public.bookings`

- [ ] **Step 1: Scrivere il test che fallisce**

`supabase/tests/004_booking_overlap.test.sql`:

```sql
begin;
select plan(6);

insert into public.facilities (id, slug, name)
  values ('11111111-1111-1111-1111-111111111111', 'test', 'Test');
insert into public.fields (id, facility_id, name, kind)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Campo 1', 'calcio5');
insert into public.price_bands (facility_id, field_id, weekdays, starts_min, ends_min, price_cents)
  values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
          '{1,2,3,4,5,6,7}', 0, 1440, 2500);
insert into public.members (id, facility_id, name, phone)
  values ('bbbbbbbb-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Rossi', '3472201563');

-- prima prenotazione: passa e calcola il prezzo
select is(
  (select price_cents from public.create_booking(
     'aaaaaaaa-0000-0000-0000-000000000001',
     tstzrange('2025-10-14 20:00+02','2025-10-14 21:30+02'),
     'bbbbbbbb-0000-0000-0000-000000000001', 'phone')),
  3750, 'la prenotazione calcola il prezzo'
);

-- sovrapposizione totale
select throws_ok(
  $$select public.create_booking(
      'aaaaaaaa-0000-0000-0000-000000000001',
      tstzrange('2025-10-14 20:00+02','2025-10-14 21:30+02'),
      'bbbbbbbb-0000-0000-0000-000000000001', 'app')$$,
  'P0004', 'Questo slot è già stato prenotato.',
  'la sovrapposizione totale è rifiutata'
);

-- sovrapposizione parziale
select throws_ok(
  $$select public.create_booking(
      'aaaaaaaa-0000-0000-0000-000000000001',
      tstzrange('2025-10-14 21:00+02','2025-10-14 22:00+02'),
      'bbbbbbbb-0000-0000-0000-000000000001', 'app')$$,
  'P0004', 'Questo slot è già stato prenotato.',
  'la sovrapposizione parziale è rifiutata'
);

-- slot adiacente: ammesso, i range sono [inizio, fine)
select lives_ok(
  $$select public.create_booking(
      'aaaaaaaa-0000-0000-0000-000000000001',
      tstzrange('2025-10-14 21:30+02','2025-10-14 22:30+02'),
      'bbbbbbbb-0000-0000-0000-000000000001', 'app')$$,
  'lo slot adiacente è ammesso'
);

-- dopo la disdetta lo slot torna libero
select lives_ok(
  $$select public.cancel_booking(
      (select id from public.bookings
        where slot = tstzrange('2025-10-14 20:00+02','2025-10-14 21:30+02')),
      'test')$$,
  'la disdetta funziona'
);
select lives_ok(
  $$select public.create_booking(
      'aaaaaaaa-0000-0000-0000-000000000001',
      tstzrange('2025-10-14 20:00+02','2025-10-14 21:30+02'),
      'bbbbbbbb-0000-0000-0000-000000000001', 'app')$$,
  'lo slot disdetto si può riprenotare'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test:db
```
Atteso: FAIL, `function public.create_booking(...) does not exist`.

- [ ] **Step 3: Scrivere `0006_bookings.sql` — tabelle e vincolo**

```sql
create table public.closures (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  field_id uuid references public.fields(id) on delete cascade,  -- null = tutti i campi
  period tstzrange not null,
  reason text
);
create index closures_facility_idx on public.closures using gist (facility_id, period);

create table public.bookings (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  slot tstzrange not null,
  status text not null default 'active'
    check (status in ('active', 'cancelled', 'no_show')),
  source text not null default 'app'
    check (source in ('phone', 'app', 'admin', 'tournament', 'recurrence')),
  price_cents integer not null,
  cancel_deadline timestamptz not null,
  recurrence_id uuid,               -- FK aggiunta nel Task 12
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  cancelled_at timestamptz,
  cancel_reason text
);

create index bookings_day_idx on public.bookings (facility_id, field_id, slot);
create index bookings_member_idx on public.bookings (member_id, slot);

-- IL vincolo. Due prenotazioni attive non possono sovrapporsi sullo stesso
-- campo, nemmeno se inserite nello stesso millisecondo da due sessioni diverse.
alter table public.bookings
  add constraint bookings_no_overlap
  exclude using gist (field_id with =, slot with &&)
  where (status = 'active');

alter table public.bookings enable row level security;
alter table public.closures enable row level security;

create policy bookings_read_own on public.bookings
  for select using (
    member_id in (select id from public.members where user_id = auth.uid())
  );
create policy bookings_read_admin on public.bookings
  for select using (public.is_facility_admin(facility_id));
-- Nessuna policy di INSERT o UPDATE: si passa solo dalle RPC.
create policy closures_read_all on public.closures
  for select using (true);
create policy closures_write_admin on public.closures
  for all using (public.is_facility_admin(facility_id))
  with check (public.is_facility_admin(facility_id));
```

L'assenza di policy `for insert` su `bookings` è deliberata: rende la regola «solo via RPC» un fatto del database, non una convenzione che qualcuno dimenticherà.

- [ ] **Step 4: Aggiungere le funzioni RPC alla stessa migrazione**

```sql
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
begin
  select * into f from public.fields where id = p_field_id and active;
  if not found then
    raise exception 'Il campo non è disponibile.' using errcode = 'P0002';
  end if;

  select * into fac from public.facilities where id = f.facility_id;

  if lower(p_slot) < now() then
    raise exception 'Non si può prenotare nel passato.' using errcode = 'P0006';
  end if;

  if lower(p_slot) > now() + make_interval(days => fac.booking_horizon_days) then
    raise exception 'Si può prenotare al massimo % giorni in anticipo.',
      fac.booking_horizon_days using errcode = 'P0007';
  end if;

  if extract(epoch from (upper(p_slot) - lower(p_slot))) / 60
     < fac.min_duration_minutes then
    raise exception 'La durata minima è di % minuti.',
      fac.min_duration_minutes using errcode = 'P0008';
  end if;

  if exists (
    select 1 from public.closures c
    where c.facility_id = fac.id
      and (c.field_id is null or c.field_id = p_field_id)
      and c.period && p_slot
  ) then
    raise exception 'Il campo è chiuso in quell orario.' using errcode = 'P0003';
  end if;

  -- Alza P0005 se lo slot cade fuori dall'orario di apertura.
  v_price := public.calc_booking_price(p_field_id, p_slot);

  insert into public.bookings (
    facility_id, field_id, member_id, slot, status, source,
    price_cents, cancel_deadline, created_by
  ) values (
    fac.id, p_field_id, p_member_id, p_slot, 'active', p_source,
    v_price, lower(p_slot) - make_interval(hours => fac.cancel_hours), auth.uid()
  ) returning * into v_row;

  return v_row;
exception
  when exclusion_violation then
    raise exception 'Questo slot è già stato prenotato.' using errcode = 'P0004';
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
    raise exception 'Prenotazione non trovata.' using errcode = 'P0009';
  end if;
  if v_row.status <> 'active' then
    raise exception 'La prenotazione è già stata disdetta.' using errcode = 'P0010';
  end if;

  v_late := now() > v_row.cancel_deadline;

  update public.bookings
     set status = 'cancelled',
         cancelled_at = now(),
         cancel_reason = p_reason
   where id = p_booking_id
   returning * into v_row;

  -- L'affidabilità si muove solo sulle disdette tardive.
  if v_late then
    update public.members set missed_count = missed_count + 1
     where id = v_row.member_id;
  end if;

  return v_row;
end;
$$;

revoke execute on function public.create_booking(uuid, tstzrange, uuid, text) from public;
revoke execute on function public.cancel_booking(uuid, text) from public;
grant execute on function public.create_booking(uuid, tstzrange, uuid, text) to authenticated;
grant execute on function public.cancel_booking(uuid, text) to authenticated;
```

- [ ] **Step 5: Eseguire il test e verificare che passi**

```bash
npm run db:reset && npm run test:db
```
Atteso: `# All 6 tests passed`.

- [ ] **Step 6: Commit**

```bash
npm run types
git add -A
git commit -m "feat(db): prenotazioni con vincolo di esclusione e RPC di creazione e disdetta"
```

---

### Task 6: Slot occupati visibili senza login

**Files:**
- Create: `supabase/migrations/0007_busy_slots.sql`
- Create: `supabase/seed.sql`
- Test: `supabase/tests/005_booking_rls.test.sql`

**Interfaces:**
- Produces: vista `busy_slots (facility_id, field_id, slot)`, leggibile da `anon`

- [ ] **Step 1: Scrivere il test che fallisce**

`supabase/tests/005_booking_rls.test.sql`:

```sql
begin;
select plan(3);

select has_view('public', 'busy_slots', 'la vista busy_slots esiste');

-- la vista non deve esporre nomi né importi
select hasnt_column('public', 'busy_slots', 'member_id',
  'busy_slots non espone member_id');
select hasnt_column('public', 'busy_slots', 'price_cents',
  'busy_slots non espone il prezzo');

select * from finish();
rollback;
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test:db
```
Atteso: FAIL, `"busy_slots" is not a view`.

- [ ] **Step 3: Scrivere `0007_busy_slots.sql`**

```sql
-- Il cliente deve vedere quali slot sono occupati senza sapere da chi.
-- La vista gira come proprietario (security_invoker off) e per questo scavalca
-- la RLS di bookings: è sicuro perché espone solo campo e intervallo.
create view public.busy_slots
with (security_invoker = off) as
  select b.facility_id, b.field_id, b.slot
  from public.bookings b
  where b.status = 'active';

grant select on public.busy_slots to anon, authenticated;
```

- [ ] **Step 4: Scrivere il seed**

`supabase/seed.sql` — dati con cui aprire l'app e vedere qualcosa fin dal primo avvio:

```sql
insert into public.facilities (id, slug, name, color, phone, address)
values ('f0000000-0000-0000-0000-000000000001', 'palacalcetto', 'Palacalcetto',
        '#146B3F', '0173441290', 'Via dello Sport 14, Alba');

insert into public.facility_domains (facility_id, hostname) values
  ('f0000000-0000-0000-0000-000000000001', 'localhost'),
  ('f0000000-0000-0000-0000-000000000001', 'prenota.palacalcetto.it');

insert into public.fields (id, facility_id, name, kind, covered, sort_order) values
  ('c0000000-0000-0000-0000-000000000001','f0000000-0000-0000-0000-000000000001','Campo 1','calcio5', true, 1),
  ('c0000000-0000-0000-0000-000000000002','f0000000-0000-0000-0000-000000000001','Campo 2','calcio5', false, 2),
  ('c0000000-0000-0000-0000-000000000003','f0000000-0000-0000-0000-000000000001','Campo 3','calcio7', false, 3);

insert into public.price_bands (facility_id, field_id, weekdays, starts_min, ends_min, price_cents)
select 'f0000000-0000-0000-0000-000000000001', f.id, w.days, w.s, w.e,
       case when f.kind = 'calcio7' then w.p + 1000 else w.p end
from public.fields f
cross join (values
  ('{1,2,3,4,5}'::smallint[], 900::smallint, 1140::smallint, 2000),
  ('{1,2,3,4,5}'::smallint[], 1140::smallint, 1440::smallint, 2500),
  ('{6,7}'::smallint[], 540::smallint, 1440::smallint, 2800)
) as w(days, s, e, p)
where f.facility_id = 'f0000000-0000-0000-0000-000000000001';

insert into public.members (facility_id, name, phone) values
  ('f0000000-0000-0000-0000-000000000001', 'Giulio Dante', '3394128807'),
  ('f0000000-0000-0000-0000-000000000001', 'Marco Ferrero', '3472201563'),
  ('f0000000-0000-0000-0000-000000000001', 'Amici del Martedì', '3401187721');
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

```bash
npm run db:reset && npm run test:db
```
Atteso: tutte le suite verdi, seed applicato senza errori.

- [ ] **Step 6: Commit**

```bash
npm run types
git add -A
git commit -m "feat(db): vista pubblica degli slot occupati e dati di esempio"
```

---

### Task 7: Client Supabase, fuso orario e struttura corrente

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/tz.ts`, `src/lib/money.ts`
- Create: `src/tenant/resolveTenant.ts`, `src/tenant/FacilityProvider.tsx`
- Test: `src/lib/tz.test.ts`, `src/tenant/resolveTenant.test.ts`

**Interfaces:**
- Produces:
  - `supabase` — client tipizzato
  - `TZ = 'Europe/Rome'`, `toLocal(d: Date): Date`, `slotRange(day: Date, startMin: number, minutes: number): string`
  - `formatEuro(cents: number): string`
  - `resolveTenantHostname(): string`
  - `useFacility(): Facility` — il componente lancia se usato fuori dal provider

- [ ] **Step 1: Scrivere i test che falliscono**

`src/lib/tz.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { slotRange } from './tz'

// Il giorno è una stringa 'yyyy-MM-dd', non una Date: così il risultato non
// dipende dal fuso della macchina che esegue i test.
describe('slotRange', () => {
  it('costruisce un intervallo Postgres semiaperto', () => {
    expect(slotRange('2025-10-14', 20 * 60, 90))
      .toBe('["2025-10-14T18:00:00.000Z","2025-10-14T19:30:00.000Z")')
  })

  it('regge il giorno del cambio ora legale', () => {
    // dopo l'ultima domenica di ottobre l'Italia è a UTC+1
    expect(slotRange('2025-10-28', 21 * 60, 60))
      .toBe('["2025-10-28T20:00:00.000Z","2025-10-28T21:00:00.000Z")')
  })
})
```

`src/tenant/resolveTenant.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { hostnameFor } from './resolveTenant'

describe('hostnameFor', () => {
  it('usa l’hostname sul web', () => {
    expect(hostnameFor({ isNative: false, hostname: 'prenota.palacalcetto.it' }))
      .toBe('prenota.palacalcetto.it')
  })

  it('usa la preferenza salvata su nativo', () => {
    expect(hostnameFor({ isNative: true, hostname: 'localhost', stored: 'palacalcetto' }))
      .toBe('palacalcetto')
  })

  it('lancia su nativo senza struttura scelta', () => {
    expect(() => hostnameFor({ isNative: true, hostname: 'localhost' })).toThrow()
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

```bash
npm run test
```
Atteso: FAIL, `Cannot find module './tz'`.

- [ ] **Step 3: Implementare `src/lib/tz.ts`**

```ts
import { fromZonedTime, toZonedTime } from 'date-fns-tz'

export const TZ = 'Europe/Rome'

const pad = (n: number) => String(n).padStart(2, '0')

/** Minuti da mezzanotte → '20:30', per etichette e aria-label. */
export function minToLabel(min: number): string {
  return `${pad(Math.floor(min / 60))}:${pad(min % 60)}`
}

/** Un istante → minuti da mezzanotte nel fuso della struttura. */
export function minutesOfDay(d: Date): number {
  const local = toZonedTime(d, TZ)
  return local.getHours() * 60 + local.getMinutes()
}

/**
 * Costruisce il letterale tstzrange che Postgres si aspetta, semiaperto:
 * l'estremo destro è escluso, per questo due slot adiacenti non collidono.
 *
 * `day` è 'yyyy-MM-dd' e `startMin` sono minuti da mezzanotte, entrambi letti
 * nel fuso della struttura: la funzione non guarda mai il fuso del dispositivo.
 * La durata si somma in minuti reali, non di orologio — una prenotazione di
 * 90 minuti dura 90 minuti anche la notte del cambio ora.
 */
export function slotRange(day: string, startMin: number, minutes: number): string {
  const start = fromZonedTime(
    `${day} ${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}:00`, TZ)
  const end = new Date(start.getTime() + minutes * 60_000)
  return `["${start.toISOString()}","${end.toISOString()}")`
}
```

- [ ] **Step 4: Implementare `src/lib/money.ts` e `src/lib/supabase.ts`**

```ts
// money.ts
export function formatEuro(cents: number): string {
  return new Intl.NumberFormat('it-IT',
    { style: 'currency', currency: 'EUR' }).format(cents / 100)
}
```

```ts
// supabase.ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
)
```

- [ ] **Step 5: Implementare `src/tenant/resolveTenant.ts`**

```ts
const STORAGE_KEY = 'facility-hostname'

export type ResolveInput = {
  isNative: boolean
  hostname: string
  stored?: string | null
}

/**
 * Unico punto in cui si decide di quale struttura stiamo parlando.
 * Sul web è l'hostname; l'app nativa gira su capacitor://localhost e non ha
 * un hostname, quindi usa la struttura scelta al primo avvio.
 */
export function hostnameFor(input: ResolveInput): string {
  if (!input.isNative) return input.hostname
  if (input.stored) return input.stored
  throw new Error('Nessuna struttura selezionata')
}

export function resolveTenantHostname(): string {
  const isNative = window.location.protocol.startsWith('capacitor')
  return hostnameFor({
    isNative,
    hostname: window.location.hostname,
    stored: localStorage.getItem(STORAGE_KEY),
  })
}
```

- [ ] **Step 6: Implementare `src/tenant/FacilityProvider.tsx`**

```tsx
import { createContext, useContext, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { resolveTenantHostname } from './resolveTenant'

export type Facility = {
  id: string
  slug: string
  name: string
  color: string
  phone: string | null
  address: string | null
  cancel_hours: number
  booking_horizon_days: number
  slot_minutes: number
  min_duration_minutes: number
  features: Record<string, boolean>
}

const Ctx = createContext<Facility | null>(null)

export function useFacility(): Facility {
  const f = useContext(Ctx)
  if (!f) throw new Error('useFacility fuori da FacilityProvider')
  return f
}

export function FacilityProvider({ children }: { children: ReactNode }) {
  const { data, isPending, error } = useQuery({
    queryKey: ['facility'],
    staleTime: Infinity,
    queryFn: async () => {
      const host = resolveTenantHostname()
      const { data, error } = await supabase
        .from('facility_domains')
        .select('facilities(*)')
        .eq('hostname', host)
        .single()
      if (error) throw error
      return data.facilities as unknown as Facility
    },
  })

  if (isPending) return <div className="p-8 text-muted">Caricamento…</div>
  if (error || !data) {
    return <div className="p-8">Struttura non trovata per questo indirizzo.</div>
  }

  // Il branding è dati, non codice: una variabile CSS, non un tema ricompilato.
  document.documentElement.style.setProperty('--pitch', data.color)

  return <Ctx.Provider value={data}>{children}</Ctx.Provider>
}
```

- [ ] **Step 7: Eseguire i test e verificare che passino**

```bash
npm run test
```
Atteso: PASS su tutti e cinque i casi.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(app): client tipizzato, fuso orario e risoluzione della struttura"
```

---

### Task 8: Accesso con codice via SMS

**Files:**
- Create: `src/auth/AuthProvider.tsx`, `src/auth/LoginPage.tsx`, `src/auth/RequireAdmin.tsx`
- Modify: `src/App.tsx`
- Test: `src/auth/RequireAdmin.test.tsx`

**Interfaces:**
- Consumes: `supabase` dal Task 7
- Produces: `useAuth(): { session, isAdmin, loading }`, componente `<RequireAdmin>`

- [ ] **Step 1: Scrivere il test che fallisce**

`src/auth/RequireAdmin.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RequireAdmin } from './RequireAdmin'
import * as auth from './AuthProvider'

describe('RequireAdmin', () => {
  it('mostra i figli a un amministratore', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue(
      { session: {} as never, isAdmin: true, loading: false })
    render(<RequireAdmin><p>griglia</p></RequireAdmin>)
    expect(screen.getByText('griglia')).toBeInTheDocument()
  })

  it('nega l’accesso a chi non è amministratore', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue(
      { session: {} as never, isAdmin: false, loading: false })
    render(<RequireAdmin><p>griglia</p></RequireAdmin>)
    expect(screen.queryByText('griglia')).not.toBeInTheDocument()
    expect(screen.getByText(/non hai accesso/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test
```
Atteso: FAIL, `Cannot find module './RequireAdmin'`.

- [ ] **Step 3: Implementare `AuthProvider.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { useFacility } from '../tenant/FacilityProvider'

type AuthState = { session: Session | null; isAdmin: boolean; loading: boolean }
const Ctx = createContext<AuthState>({ session: null, isAdmin: false, loading: true })

export function useAuth(): AuthState {
  return useContext(Ctx)
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const facility = useFacility()
  const [state, setState] = useState<AuthState>(
    { session: null, isAdmin: false, loading: true })

  useEffect(() => {
    let alive = true

    async function refresh(session: Session | null) {
      if (!session) {
        if (alive) setState({ session: null, isAdmin: false, loading: false })
        return
      }
      const { data } = await supabase
        .from('facility_admins')
        .select('role')
        .eq('facility_id', facility.id)
        .eq('user_id', session.user.id)
        .maybeSingle()
      if (alive) setState({ session, isAdmin: !!data, loading: false })
    }

    supabase.auth.getSession().then(({ data }) => refresh(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => refresh(s))
    return () => { alive = false; sub.subscription.unsubscribe() }
  }, [facility.id])

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}
```

- [ ] **Step 4: Implementare `RequireAdmin.tsx`**

```tsx
import type { ReactNode } from 'react'
import { useAuth } from './AuthProvider'
import { LoginPage } from './LoginPage'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading } = useAuth()
  if (loading) return <div className="p-8 text-muted">Caricamento…</div>
  if (!session) return <LoginPage />
  if (!isAdmin) {
    return (
      <div className="p-8">
        <p className="font-medium">Non hai accesso a questa pagina.</p>
        <p className="text-muted text-sm mt-1">
          Chiedi al titolare dell’impianto di abilitare il tuo numero.
        </p>
      </div>
    )
  }
  return <>{children}</>
}
```

- [ ] **Step 5: Implementare `LoginPage.tsx`**

Markup e classi come da `docs/mockups/02-catalogo-schermate.html`, sezione **Accesso · schermo largo** (`.login`, `.loginart`, `.loginform`, `.otp`). Comportamento:

```tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Supabase vuole il numero in E.164. Il gestore digita "347 220 15 63".
  function toE164(raw: string): string {
    const digits = raw.replace(/\D/g, '')
    return digits.startsWith('39') ? `+${digits}` : `+39${digits}`
  }

  async function sendCode() {
    setError(null)
    const { error } = await supabase.auth.signInWithOtp({ phone: toE164(phone) })
    if (error) setError('Non siamo riusciti a mandare il codice. Riprova.')
    else setSent(true)
  }

  async function verify() {
    setError(null)
    const { error } = await supabase.auth.verifyOtp(
      { phone: toE164(phone), token: code, type: 'sms' })
    if (error) setError('Codice non valido o scaduto.')
  }

  return sent
    ? <OtpForm code={code} onChange={setCode} onSubmit={verify} error={error} />
    : <PhoneForm phone={phone} onChange={setPhone} onSubmit={sendCode} error={error} />
}
```

`PhoneForm` e `OtpForm` sono due componenti nello stesso file: sono usati solo qui e separarli non aggiungerebbe niente.

- [ ] **Step 6: Configurare il provider SMS in locale**

In `supabase/config.toml`, per lo sviluppo:

```toml
[auth.sms]
enable_signup = true
enable_confirmations = false

[auth.sms.test_otp]
"+393472201563" = "472839"
```

Con `test_otp` non parte nessun SMS reale e il codice `472839` funziona sempre in locale. Il provider vero (Twilio o simile) si configura in fase 1B, quando serve un utente reale.

- [ ] **Step 7: Eseguire i test e verificare che passino**

```bash
npm run test
```
Atteso: PASS su entrambi i casi di `RequireAdmin`.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(auth): accesso con codice SMS e guardia amministratore"
```

---

### Task 9: Griglia del giorno, sola lettura

**Files:**
- Create: `src/admin/DayGrid.hooks.ts`, `src/admin/DayGrid.tsx`, `src/admin/BookingCell.tsx`
- Modify: `src/App.tsx` (rotta `/admin`)
- Test: `src/admin/DayGrid.test.tsx`

**Interfaces:**
- Consumes: `useFacility()`, `slotRange`, `formatEuro`
- Produces:
  - `useDayBookings(day: Date): { bookings: BookingRow[]; fields: FieldRow[]; isPending: boolean }`
  - tipo `BookingRow = { id, field_id, member_name, slot_start: Date, slot_end: Date, source, price_cents, status }`

- [ ] **Step 1: Scrivere il test che fallisce**

`src/admin/DayGrid.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DayGrid } from './DayGrid'
import * as hooks from './DayGrid.hooks'

const fields = [{ id: 'c1', name: 'Campo 1', kind: 'calcio5', sort_order: 1 }]

describe('DayGrid', () => {
  it('disegna una prenotazione col nome e la fascia oraria', () => {
    vi.spyOn(hooks, 'useDayBookings').mockReturnValue({
      isPending: false,
      fields,
      bookings: [{
        id: 'b1', field_id: 'c1', member_name: 'Rossi',
        slot_start: new Date('2025-10-14T20:00:00+02:00'),
        slot_end: new Date('2025-10-14T21:30:00+02:00'),
        source: 'phone', price_cents: 3750, status: 'active',
      }],
    } as never)

    render(<DayGrid day={new Date('2025-10-14T00:00:00+02:00')} onSlotClick={() => {}} />)
    expect(screen.getByText('Rossi')).toBeInTheDocument()
    expect(screen.getByText(/20:00–21:30/)).toBeInTheDocument()
  })

  it('mostra il campo anche quando non ha prenotazioni', () => {
    vi.spyOn(hooks, 'useDayBookings').mockReturnValue(
      { isPending: false, fields, bookings: [] } as never)
    render(<DayGrid day={new Date()} onSlotClick={() => {}} />)
    expect(screen.getByText('Campo 1')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test
```
Atteso: FAIL, `Cannot find module './DayGrid'`.

- [ ] **Step 3: Implementare `DayGrid.hooks.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { endOfDay, startOfDay } from 'date-fns'
import { supabase } from '../lib/supabase'
import { useFacility } from '../tenant/FacilityProvider'

export type BookingRow = {
  id: string
  field_id: string
  member_name: string
  member_phone: string | null
  slot_start: Date
  slot_end: Date
  source: string
  price_cents: number
  status: string
  cancel_deadline: string
}

// Postgres restituisce tstzrange come '["2025-10-14 20:00:00+02","...")'
function parseRange(raw: string): [Date, Date] {
  const [a, b] = raw.slice(1, -1).split(',').map((s) => s.replace(/"/g, ''))
  return [new Date(a), new Date(b)]
}

export function useDayBookings(day: Date) {
  const facility = useFacility()

  const fieldsQ = useQuery({
    queryKey: ['fields', facility.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('fields')
        .select('id, name, kind, covered, sort_order')
        .eq('facility_id', facility.id)
        .eq('active', true)
        .order('sort_order')
      if (error) throw error
      return data
    },
  })

  const bookingsQ = useQuery({
    queryKey: ['bookings', facility.id, startOfDay(day).toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, field_id, slot, source, price_cents, status, cancel_deadline, members(name, phone)')
        .eq('facility_id', facility.id)
        .eq('status', 'active')
        .overlaps('slot', `[${startOfDay(day).toISOString()},${endOfDay(day).toISOString()})`)
      if (error) throw error
      return data.map((r): BookingRow => {
        const [s, e] = parseRange(r.slot as unknown as string)
        return {
          id: r.id, field_id: r.field_id,
          member_name: (r.members as { name: string } | null)?.name ?? '—',
          member_phone: (r.members as { phone: string | null } | null)?.phone ?? null,
          slot_start: s, slot_end: e,
          source: r.source, price_cents: r.price_cents, status: r.status,
          cancel_deadline: r.cancel_deadline,
        }
      })
    },
  })

  return {
    fields: fieldsQ.data ?? [],
    bookings: bookingsQ.data ?? [],
    isPending: fieldsQ.isPending || bookingsQ.isPending,
  }
}
```

- [ ] **Step 4: Implementare `DayGrid.tsx` e `BookingCell.tsx`**

Struttura e classi come da `docs/mockups/01-proposta-design.html`, sezione **Pannello gestore** (`.grid`, `.cols`, `.tick`, `.cell`, `.bk`). La griglia è una CSS grid: colonna 1 per gli orari, una colonna per campo, righe da mezz'ora. Le prenotazioni sono figli della stessa griglia posizionati con `gridRow`, così si sovrappongono alle celle di sfondo senza calcoli di posizione assoluta.

```tsx
import { minToLabel, minutesOfDay } from '../lib/tz'

const OPEN_MIN = 15 * 60   // 15:00 — leggere da facility in fase 1B
const CLOSE_MIN = 24 * 60  // 24:00
const STEP = 30

// minutesOfDay converte nel fuso della struttura: usare getHours() darebbe
// la riga sbagliata su un dispositivo con fuso diverso.
function rowFor(d: Date, step: number): number {
  return Math.round((minutesOfDay(d) - OPEN_MIN) / step) + 1
}

export function DayGrid({ day, onSlotClick }: {
  day: Date
  onSlotClick: (fieldId: string, startMin: number) => void
}) {
  const { fields, bookings, isPending } = useDayBookings(day)
  if (isPending) return <div className="p-6 text-muted">Caricamento…</div>

  const rows = (CLOSE_MIN - OPEN_MIN) / STEP

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[480px]"
           style={{ gridTemplateColumns: `52px repeat(${fields.length}, minmax(112px, 1fr))`,
                    gridAutoRows: '29px' }}>
        {/* celle di sfondo, cliccabili */}
        {fields.map((f, col) =>
          Array.from({ length: rows }, (_, r) => (
            <button key={`${f.id}-${r}`}
              onClick={() => onSlotClick(f.id, OPEN_MIN + r * STEP)}
              className="border-b border-r border-line-soft hover:bg-pitch-tint"
              style={{ gridColumn: col + 2, gridRow: r + 1 }}
              aria-label={`${f.name} alle ${minToLabel(OPEN_MIN + r * STEP)}`} />
          )))}
        {/* prenotazioni sopra */}
        {bookings.map((b) => (
          <BookingCell key={b.id} booking={b}
            column={fields.findIndex((f) => f.id === b.field_id) + 2}
            rowStart={rowFor(b.slot_start, STEP)}
            rowEnd={rowFor(b.slot_end, STEP)} />
        ))}
      </div>
    </div>
  )
}
```

`BookingCell.tsx` colora il blocco secondo `source`, come la legenda del mockup:

```tsx
import { minToLabel, minutesOfDay } from '../lib/tz'
import type { BookingRow } from './DayGrid.hooks'

const TONE: Record<string, string> = {
  phone: 'bg-terra-tint border-terra text-terra',
  app: 'bg-pitch-tint border-pitch text-pitch',
  recurrence: 'bg-slate-tint border-slate text-slate',
  tournament: 'bg-ochre-tint border-ochre text-ochre',
  admin: 'bg-terra-tint border-terra text-terra',
}

export function BookingCell({ booking, column, rowStart, rowEnd }: {
  booking: BookingRow
  column: number
  rowStart: number
  rowEnd: number
}) {
  const tone = TONE[booking.source] ?? TONE.app
  return (
    <button
      style={{ gridColumn: column, gridRow: `${rowStart} / ${rowEnd}` }}
      className={`m-[2px] rounded-md border-l-[3px] px-2 py-1 overflow-hidden text-left ${tone}`}
    >
      <div className="text-[11.5px] font-medium truncate">{booking.member_name}</div>
      <div className="text-[9.5px] opacity-80 truncate font-mono">
        {minToLabel(minutesOfDay(booking.slot_start))}–
        {minToLabel(minutesOfDay(booking.slot_end))}
        {booking.member_phone ? ` · ${booking.member_phone}` : ''}
      </div>
    </button>
  )
}
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

```bash
npm run test
```
Atteso: PASS su entrambi i casi.

- [ ] **Step 6: Guardare la pagina vera**

```bash
npm run dev
```
Apri `/admin`, accedi col numero di test, verifica che i tre campi del seed compaiano e che la griglia copra dalle 15:00 alle 24:00.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(admin): griglia del giorno in sola lettura"
```

---

### Task 10: Inserimento della telefonata

**Files:**
- Create: `src/admin/NewBookingDialog.tsx`, `src/admin/useCreateBooking.ts`
- Modify: `src/admin/DayGrid.tsx` (collegare `onSlotClick`)
- Test: `src/admin/useCreateBooking.test.ts`

**Interfaces:**
- Consumes: `slotRange` dal Task 7, `create_booking` RPC dal Task 5
- Produces: `useCreateBooking(): { mutate, isPending, error }` e `messageForError(code: string): string`

- [ ] **Step 1: Scrivere il test che fallisce**

`src/admin/useCreateBooking.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { messageForError } from './useCreateBooking'

describe('messageForError', () => {
  it('traduce la collisione in una frase utile', () => {
    expect(messageForError('P0004'))
      .toBe('Questo slot è appena stato prenotato da qualcun altro. Scegline un altro.')
  })
  it('traduce lo slot fuori orario', () => {
    expect(messageForError('P0005'))
      .toBe('Non c’è una tariffa per quell’orario: il campo è fuori apertura.')
  })
  it('ha un messaggio di riserva', () => {
    expect(messageForError('XXXXX')).toMatch(/non è riuscita/i)
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test
```
Atteso: FAIL, `Cannot find module './useCreateBooking'`.

- [ ] **Step 3: Implementare `useCreateBooking.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { slotRange } from '../lib/tz'

const MESSAGES: Record<string, string> = {
  P0002: 'Il campo non è disponibile.',
  P0003: 'Il campo è chiuso in quell’orario.',
  P0004: 'Questo slot è appena stato prenotato da qualcun altro. Scegline un altro.',
  P0005: 'Non c’è una tariffa per quell’orario: il campo è fuori apertura.',
  P0006: 'Non si può prenotare nel passato.',
  P0008: 'La durata è inferiore al minimo consentito.',
}

export function messageForError(code: string): string {
  return MESSAGES[code] ?? 'La prenotazione non è riuscita. Riprova.'
}

export type NewBooking = {
  fieldId: string
  day: string          // 'yyyy-MM-dd' nel fuso della struttura
  startMin: number
  minutes: number
  memberId: string
}

export function useCreateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewBooking) => {
      const { data, error } = await supabase.rpc('create_booking', {
        p_field_id: input.fieldId,
        p_slot: slotRange(input.day, input.startMin, input.minutes),
        p_member_id: input.memberId,
        p_source: 'phone',
      })
      if (error) throw new Error(messageForError(error.code ?? ''))
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  })
}
```

- [ ] **Step 4: Implementare `NewBookingDialog.tsx`**

Markup come da `docs/mockups/01-proposta-design.html`, il riquadro **Nuova prenotazione**. Tre campi e via: nome, telefono, durata come gruppo di tre pulsanti.

Il campo nome cerca fra i `members` esistenti mentre si digita e propone i risultati; se nessuno corrisponde, alla conferma crea la riga con `user_id` nullo. È il punto in cui si evita metà dei doppioni:

```tsx
async function resolveMember(facilityId: string, name: string, phone: string) {
  if (phone) {
    const { data } = await supabase.from('members')
      .select('id').eq('facility_id', facilityId).eq('phone', phone).maybeSingle()
    if (data) return data.id
  }
  const { data, error } = await supabase.from('members')
    .insert({ facility_id: facilityId, name, phone: phone || null })
    .select('id').single()
  if (error) throw error
  return data.id
}
```

Requisiti d'uso, non negoziabili perché è la schermata che il gestore usa col telefono all'orecchio: il solo campo obbligatorio è il nome, il fuoco è sul campo nome all'apertura, e `Invio` conferma.

- [ ] **Step 5: Eseguire i test e verificare che passino**

```bash
npm run test
```
Atteso: PASS su tutti e tre i casi.

- [ ] **Step 6: Provare la collisione a mano**

Con `npm run dev` aperto in due finestre del browser, prenota lo stesso slot da entrambe. La seconda deve mostrare *«Questo slot è appena stato prenotato da qualcun altro»*, non un errore tecnico.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(admin): inserimento prenotazione telefonica"
```

---

### Task 11: Dettaglio prenotazione e disdetta

**Files:**
- Create: `src/admin/BookingDetailDialog.tsx`, `src/admin/useCancelBooking.ts`
- Modify: `src/admin/BookingCell.tsx` (aprire il dialogo al clic)
- Test: `src/admin/useCancelBooking.test.ts`

**Interfaces:**
- Consumes: `cancel_booking` RPC dal Task 5, `BookingRow` dal Task 9
- Produces: `useCancelBooking(): { mutate, isPending }`, `isLateCancel(deadline: Date, now: Date): boolean`

- [ ] **Step 1: Scrivere il test che fallisce**

`src/admin/useCancelBooking.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { isLateCancel } from './useCancelBooking'

describe('isLateCancel', () => {
  it('prima della scadenza la disdetta è gratuita', () => {
    expect(isLateCancel(
      new Date('2025-10-14T20:30:00Z'), new Date('2025-10-14T18:00:00Z'))).toBe(false)
  })
  it('dopo la scadenza la disdetta è tardiva', () => {
    expect(isLateCancel(
      new Date('2025-10-14T20:30:00Z'), new Date('2025-10-14T21:00:00Z'))).toBe(true)
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test
```
Atteso: FAIL, `Cannot find module './useCancelBooking'`.

- [ ] **Step 3: Implementare `useCancelBooking.ts`**

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function isLateCancel(deadline: Date, now: Date): boolean {
  return now > deadline
}

export function useCancelBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('cancel_booking', {
        p_booking_id: id,
        p_reason: reason ?? null,
      })
      if (error) throw new Error('La disdetta non è riuscita. Riprova.')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  })
}
```

- [ ] **Step 4: Implementare `BookingDetailDialog.tsx`**

Markup come da `docs/mockups/02-catalogo-schermate.html`, sezione **Dettaglio prenotazione**. Mostra chi ha prenotato, il telefono, l'importo da incassare, l'origine e la scadenza di disdetta.

Il punto che conta è che il gestore sappia **prima di premere** se sta disdicendo in ritardo, perché la disdetta tardiva incide sull'affidabilità del cliente:

```tsx
const late = isLateCancel(new Date(booking.cancel_deadline), new Date())

<button onClick={() => setConfirming(true)}
  className="w-full rounded-lg border border-terra text-terra py-2 text-sm">
  Disdici la prenotazione
</button>

{confirming && (
  <div className="rounded-lg border border-terra bg-terra-tint p-3 text-[12.5px] text-terra">
    {late
      ? 'Siamo oltre il termine di disdetta: la prenotazione risulterà come mancata presenza e inciderà sull’affidabilità del cliente.'
      : 'Il campo torna subito libero per gli altri e il cliente non paga nulla.'}
    <div className="flex gap-2 justify-end mt-3">
      <button onClick={() => setConfirming(false)}>Annulla</button>
      <button onClick={() => cancel.mutate({ id: booking.id })}>Conferma la disdetta</button>
    </div>
  </div>
)}
```

- [ ] **Step 5: Eseguire i test e verificare che passino**

```bash
npm run test
```
Atteso: PASS su entrambi i casi.

- [ ] **Step 6: Verificare a mano**

Con `npm run dev`, clicca una prenotazione della griglia: si apre il dettaglio. Disdici: **il blocco sparisce dalla griglia e lo slot torna prenotabile.**

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(admin): dettaglio prenotazione e disdetta"
```

---

### Task 12: Aggiornamento in tempo reale

**Files:**
- Modify: `src/admin/DayGrid.hooks.ts`
- Test: `supabase/tests/005_booking_rls.test.sql` (aggiunta)

**Interfaces:**
- Produces: `useDayBookings` si aggiorna da solo quando `bookings` cambia sul server

- [ ] **Step 1: Abilitare la pubblicazione realtime**

Nuova migrazione `supabase/migrations/0009_realtime.sql`:

```sql
alter publication supabase_realtime add table public.bookings;
```

- [ ] **Step 2: Aggiungere la sottoscrizione a `DayGrid.hooks.ts`**

```ts
import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

// dentro useDayBookings, dopo le due query:
const qc = useQueryClient()
useEffect(() => {
  const channel = supabase
    .channel(`bookings-${facility.id}`)
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'bookings',
        filter: `facility_id=eq.${facility.id}` },
      () => qc.invalidateQueries({ queryKey: ['bookings', facility.id] }))
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}, [facility.id, qc])
```

Si invalida la query invece di applicare la modifica al volo: la riga che arriva dal canale non passa dalle stesse policy della `select`, e ricaricare costa poco su una giornata di prenotazioni.

- [ ] **Step 3: Verificare a mano**

Apri `/admin` in due finestre. Crea una prenotazione in una: **deve comparire nell'altra entro un secondo, senza ricaricare la pagina.**

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(admin): la griglia si aggiorna in tempo reale"
```

---

### Task 13: Prenotazioni ricorrenti

**Files:**
- Create: `supabase/migrations/0008_recurrences.sql`
- Create: `src/admin/RecurrenceForm.tsx`
- Modify: `src/admin/NewBookingDialog.tsx`
- Test: `supabase/tests/006_recurrences.test.sql`

**Interfaces:**
- Consumes: `create_booking` dal Task 5
- Produces: tabella `recurrences`; funzione `generate_recurrence(p_recurrence_id uuid) returns table(created integer, skipped integer, skipped_dates date[])`

- [ ] **Step 1: Scrivere il test che fallisce**

`supabase/tests/006_recurrences.test.sql`:

```sql
begin;
select plan(3);

insert into public.facilities (id, slug, name)
  values ('11111111-1111-1111-1111-111111111111', 'test', 'Test');
insert into public.fields (id, facility_id, name, kind)
  values ('aaaaaaaa-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Campo 1', 'calcio5');
insert into public.price_bands (facility_id, field_id, weekdays, starts_min, ends_min, price_cents)
  values ('11111111-1111-1111-1111-111111111111','aaaaaaaa-0000-0000-0000-000000000001',
          '{1,2,3,4,5,6,7}', 0, 1440, 2500);
insert into public.members (id, facility_id, name)
  values ('bbbbbbbb-0000-0000-0000-000000000001',
          '11111111-1111-1111-1111-111111111111', 'Amici del Martedì');

-- ogni martedì di ottobre 2026: 6, 13, 20, 27 → 4 occorrenze
insert into public.recurrences (id, facility_id, field_id, member_id,
  weekday, start_min, duration_minutes, from_date, to_date)
values ('cccccccc-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'aaaaaaaa-0000-0000-0000-000000000001',
        'bbbbbbbb-0000-0000-0000-000000000001',
        2, 1260, 90, '2026-10-01', '2026-10-31');

select is(
  (select created from public.generate_recurrence('cccccccc-0000-0000-0000-000000000001')),
  4, 'genera quattro martedì'
);

select is(
  (select count(*)::integer from public.bookings
    where recurrence_id = 'cccccccc-0000-0000-0000-000000000001'),
  4, 'le occorrenze sono prenotazioni normali'
);

-- cancellare una occorrenza non tocca le altre
select public.cancel_booking(
  (select id from public.bookings
    where recurrence_id = 'cccccccc-0000-0000-0000-000000000001'
    order by slot limit 1), 'test');
select is(
  (select count(*)::integer from public.bookings
    where recurrence_id = 'cccccccc-0000-0000-0000-000000000001'
      and status = 'active'),
  3, 'cancellare una occorrenza lascia le altre'
);

select * from finish();
rollback;
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test:db
```
Atteso: FAIL, `relation "public.recurrences" does not exist`.

- [ ] **Step 3: Scrivere `0008_recurrences.sql`**

```sql
create table public.recurrences (
  id uuid primary key default gen_random_uuid(),
  facility_id uuid not null references public.facilities(id) on delete cascade,
  field_id uuid not null references public.fields(id) on delete restrict,
  member_id uuid not null references public.members(id) on delete restrict,
  weekday smallint not null check (weekday between 1 and 7),  -- ISO: 1 = lunedì
  start_min smallint not null check (start_min >= 0 and start_min < 1440),
  duration_minutes smallint not null check (duration_minutes > 0),
  from_date date not null,
  to_date date not null,
  created_at timestamptz not null default now(),
  check (to_date >= from_date)
);

alter table public.bookings
  add constraint bookings_recurrence_fk
  foreign key (recurrence_id) references public.recurrences(id) on delete set null;

-- Le occorrenze sono prenotazioni vere, generate una volta: non una regola
-- valutata a runtime. Solo così ognuna è cancellabile e spostabile da sola.
create or replace function public.generate_recurrence(p_recurrence_id uuid)
returns table (created integer, skipped integer, skipped_dates date[])
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.recurrences;
  d date;
  tz constant text := 'Europe/Rome';
  v_slot tstzrange;
  v_booking public.bookings;
  n_created integer := 0;
  n_skipped integer := 0;
  skipped date[] := '{}';
begin
  select * into r from public.recurrences where id = p_recurrence_id;
  if not found then
    raise exception 'Ricorrenza non trovata.' using errcode = 'P0011';
  end if;

  for d in
    select gs::date from generate_series(r.from_date, r.to_date, interval '1 day') gs
    where extract(isodow from gs) = r.weekday
  loop
    v_slot := tstzrange(
      (d + make_interval(mins => r.start_min)) at time zone tz,
      (d + make_interval(mins => r.start_min + r.duration_minutes)) at time zone tz,
      '[)'
    );
    begin
      -- La variabile si chiama v_slot e non slot: `slot = slot` avrebbe
      -- confrontato la colonna con sé stessa, marcando come ricorrenti
      -- tutte le prenotazioni attive del campo.
      v_booking := public.create_booking(r.field_id, v_slot, r.member_id, 'recurrence');
      update public.bookings set recurrence_id = r.id where id = v_booking.id;
      n_created := n_created + 1;
    exception when others then
      -- Una data occupata non ferma la generazione: si salta e si segnala.
      n_skipped := n_skipped + 1;
      skipped := skipped || d;
    end;
  end loop;

  return query select n_created, n_skipped, skipped;
end;
$$;

alter table public.recurrences enable row level security;

create policy recurrences_read_admin on public.recurrences
  for select using (public.is_facility_admin(facility_id));
create policy recurrences_write_admin on public.recurrences
  for all using (public.is_facility_admin(facility_id))
  with check (public.is_facility_admin(facility_id));

grant execute on function public.generate_recurrence(uuid) to authenticated;
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npm run db:reset && npm run test:db
```
Atteso: `# All 3 tests passed`.

- [ ] **Step 5: Aggiungere la spunta nel dialogo**

In `NewBookingDialog.tsx`, sotto la durata, la casella come da mockup: *«Ripeti ogni martedì fino al …»* con il conteggio delle date. Alla conferma, invece di `create_booking` si inserisce la `recurrences` e si chiama `generate_recurrence`. Il risultato va mostrato per intero:

```tsx
const { created, skipped, skipped_dates } = result
toast.success(
  skipped === 0
    ? `Create ${created} date.`
    : `Create ${created} date. ${skipped} saltate perché il campo era già occupato: ` +
      skipped_dates.map((d) => format(new Date(d), 'd MMM', { locale: it })).join(', ')
)
```

Segnalare le date saltate non è un dettaglio: senza, il gestore crede di aver bloccato la stagione e scopre il buco a gennaio.

- [ ] **Step 6: Verificare a mano**

Crea una ricorrenza settimanale su una data già occupata: il messaggio deve dire quante ne ha create e quali ha saltato.

- [ ] **Step 7: Commit**

```bash
npm run types
git add -A
git commit -m "feat(admin): prenotazioni ricorrenti con occorrenze generate"
```

---

## Fine della fase 1A

Al termine il gestore può gestire l'intera giornata dal tablet: vede la griglia dei tre campi, inserisce le telefonate in tre tocchi, blocca i gruppi fissi della stagione, disdice, e vede comparire in tempo reale quello che succede. Il vincolo Postgres garantisce che due prenotazioni non si sovrappongano mai.

**Cosa resta alla fase 1B:** home pubblica e app cliente, anagrafica clienti con fusione dei doppioni, bacheca avvisi, gestione di campi, tariffe e chiusure dall'interfaccia, impostazioni struttura e feature flag, PWA installabile, notifiche di promemoria, backup notturno via GitHub Action, provider SMS reale.

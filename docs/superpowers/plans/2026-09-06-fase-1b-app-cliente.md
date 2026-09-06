# Fase 1B · App cliente — piano di implementazione

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dare al giocatore una porta d'ingresso — guardare i campi liberi senza account, entrare con Google, prenotare, disdire e ritrovare lo storico delle telefonate — senza spostare lavoro sul gestore.

**Architecture:** Stessa SPA della fase 1A, rotte nuove accanto a `/admin`, che passa a caricamento pigro. Nessuna colonna nuova nel database. Le RPC esistenti vengono corrette perché autorizzino, non solo eseguano: oggi non guardano chi le chiama, e aprire l'accesso ai clienti renderebbe sfruttabile un buco che in fase 1A era latente.

**Tech Stack:** React 19 · TypeScript · Vite 8 · Tailwind 4 · TanStack Query · React Router · date-fns-tz · Supabase (Postgres, Auth OAuth + OTP, Realtime) · pgTAP · Vitest · vite-plugin-pwa

**Spec:** `docs/superpowers/specs/2026-09-06-fase-1b-app-cliente-design.md`

**Mockup di riferimento:** `docs/mockups/01-proposta-design.html` e `docs/mockups/02-catalogo-schermate.html`. Quando un task dice «markup come da mockup, sezione X», quello è un riferimento concreto a un file presente nel repository, non un segnaposto: il markup, le classi e le variabili CSS sono lì, vanno letti e portati nei componenti. I nomi delle classi del mockup corrispondono ai token già definiti in `src/index.css`.

## Global Constraints

- **Il primo task non è una schermata.** Finché le RPC non autorizzano, ogni cliente autenticato può disdire le prenotazioni di chiunque. Nessuna rotta cliente va in produzione prima del Task 1.
- **I test pgTAP devono impersonare un utente.** Da superutente `auth.uid()` è nullo e l'autorizzazione non viene mai esercitata. Il modo verificato è `set local role authenticated` più `set local request.jwt.claims`, dopo gli inserimenti di preparazione e prima delle asserzioni.
- **Ogni RPC ha un test sul caso negativo.** Non basta che il proprietario riesca: serve provare che un altro fallisca.
- **Codici di errore nella classe privata `PS`**, mai in `P0`, che è riservata a PL/pgSQL — `P0004` è `assert_failure` e `when others` non lo cattura.
- **Denaro in centesimi.** Orari delle fasce in minuti da mezzanotte (0..1440).
- **Ogni istante è `timestamptz`.** Fuso `Europe/Rome`, dalla costante in `src/lib/tz.ts`.
- **Nessuna `insert`/`update` diretta su `bookings` dal client.** Solo RPC.
- **RLS attiva su ogni tabella**, nella stessa migrazione che la crea.
- **Identificatori in inglese, testo utente e messaggi d'errore in italiano.**
- **Apple resta fuori.** Richiede un account a pagamento che la specifica di progetto colloca in fase 4.

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
  migrations/
    0011_rpc_authorization.sql   owns_member(), create_booking e cancel_booking corrette
    0012_member_identity.sql     claim_members_by_verified_phone(), ensure_my_member()
  tests/
    007_rpc_authorization.test.sql
    008_member_identity.test.sql
    004_booking_overlap.test.sql  (modificato: impersona un amministratore)
    006_recurrences.test.sql      (modificato: idem)

src/
  public/
    HomePage.tsx              home pubblica, disponibilità di oggi
    freeSlots.ts              calcolo delle fasce libere, funzione pura
    BookPage.tsx              scelta campo, giorno, ora
    BookPage.hooks.ts         busy_slots + campi + fasce
    ConfirmBookingDialog.tsx  riepilogo, conferma, accesso se serve
    MyBookingsPage.tsx        le tue prenotazioni
    BookingPage.tsx           dettaglio e disdetta lato cliente
  auth/
    ClaimPhoneDialog.tsx      telefono, verifica via SMS, rivendicazione
    useMyMember.ts            il member dell'utente in questa struttura
  App.tsx                     rotte pubbliche, /admin pigro
```

`freeSlots.ts` è separato da `BookPage.hooks.ts` di proposito: il calcolo delle fasce libere è la sola logica non banale di questa metà del prodotto, e va provato con dati finti invece che con il database.

---

### Task 1: Le RPC autorizzano, non solo eseguono

**Files:**
- Create: `supabase/migrations/0011_rpc_authorization.sql`
- Create: `supabase/tests/007_rpc_authorization.test.sql`
- Modify: `supabase/tests/004_booking_overlap.test.sql`
- Modify: `supabase/tests/006_recurrences.test.sql`
- Modify: `src/admin/useCreateBooking.ts`

**Interfaces:**
- Consumes: `is_facility_admin(uuid)`, `create_booking(uuid, tstzrange, uuid, text)`, `cancel_booking(uuid, text)` dalla fase 1A
- Produces: `owns_member(p_member_id uuid) returns boolean`; codici `PS012` (non autenticato) e `PS013` (member di un altro)

- [ ] **Step 1: Scrivere il test che fallisce**

`supabase/tests/007_rpc_authorization.test.sql`:

```sql
begin;
select plan(5);

insert into public.facilities (id, slug, name, booking_horizon_days)
  values ('d0000000-0000-0000-0000-000000000001', 'test', 'Test', 3650);
insert into public.fields (id, facility_id, name, kind)
  values ('d0000000-0000-0000-0000-0000000000f1',
          'd0000000-0000-0000-0000-000000000001', 'Campo 1', 'calcio5');
insert into public.price_bands (facility_id, field_id, weekdays, starts_min, ends_min, price_cents)
  values ('d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-0000000000f1',
          '{1,2,3,4,5,6,7}', 0, 1440, 2500);

-- tre identità: un gestore, il proprietario della prenotazione, un estraneo
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000a',
   'authenticated','authenticated','390000000001', now(), '','','','', now(), now()),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000b',
   'authenticated','authenticated','390000000002', now(), '','','','', now(), now()),
  ('00000000-0000-0000-0000-000000000000','d0000000-0000-0000-0000-00000000000c',
   'authenticated','authenticated','390000000003', now(), '','','','', now(), now());

insert into public.facility_admins (facility_id, user_id)
  values ('d0000000-0000-0000-0000-000000000001','d0000000-0000-0000-0000-00000000000a');

insert into public.members (id, facility_id, user_id, name) values
  ('d0000000-0000-0000-0000-0000000000b1','d0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-00000000000b','Proprietario'),
  ('d0000000-0000-0000-0000-0000000000c1','d0000000-0000-0000-0000-000000000001',
   'd0000000-0000-0000-0000-00000000000c','Estraneo');

-- il gestore crea una prenotazione per il proprietario
set local role authenticated;
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-00000000000a","role":"authenticated"}';

select lives_ok(
  $$select public.create_booking('d0000000-0000-0000-0000-0000000000f1',
      tstzrange(now() + interval '10 days', now() + interval '10 days 1 hour'),
      'd0000000-0000-0000-0000-0000000000b1', 'phone')$$,
  'il gestore prenota per conto di un cliente'
);

-- l'estraneo non può prenotare a nome del proprietario
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-00000000000c","role":"authenticated"}';

select throws_ok(
  $$select public.create_booking('d0000000-0000-0000-0000-0000000000f1',
      tstzrange(now() + interval '11 days', now() + interval '11 days 1 hour'),
      'd0000000-0000-0000-0000-0000000000b1', 'app')$$,
  'PS013', 'Non puoi prenotare a nome di un altro.',
  'un estraneo non prenota a nome di un altro'
);

-- ma può prenotare per sé
select lives_ok(
  $$select public.create_booking('d0000000-0000-0000-0000-0000000000f1',
      tstzrange(now() + interval '12 days', now() + interval '12 days 1 hour'),
      'd0000000-0000-0000-0000-0000000000c1', 'app')$$,
  'un cliente prenota per sé'
);

-- IL CASO CHE CONTA: l'estraneo non può disdire la prenotazione di un altro
select throws_ok(
  $$select public.cancel_booking(
      (select id from public.bookings
        where member_id = 'd0000000-0000-0000-0000-0000000000b1' limit 1), 'furto')$$,
  'PS013', 'Non puoi disdire la prenotazione di un altro.',
  'un estraneo non disdice la prenotazione di un altro'
);

-- il proprietario sì
set local request.jwt.claims to '{"sub":"d0000000-0000-0000-0000-00000000000b","role":"authenticated"}';
select lives_ok(
  $$select public.cancel_booking(
      (select id from public.bookings
        where member_id = 'd0000000-0000-0000-0000-0000000000b1' limit 1), 'ci ripenso')$$,
  'il proprietario disdice la propria'
);

reset role;
select * from finish();
rollback;
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test:db
```
Atteso: FAIL. I due `throws_ok` non vedono nessuna eccezione, perché oggi le RPC non controllano nulla.

- [ ] **Step 3: Scrivere `0011_rpc_authorization.sql`**

```sql
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
```

- [ ] **Step 4: Aggiornare i test della fase 1A perché impersonino un amministratore**

`004_booking_overlap.test.sql` e `006_recurrences.test.sql` chiamano `create_booking` da superutente: con il controllo nuovo riceverebbero `PS012`. Non è una regressione, è la prova che il controllo funziona — vanno adeguati.

In **entrambi** i file, subito dopo gli `insert` di preparazione e prima della prima asserzione, inserisci:

```sql
-- Un amministratore vero, e ci si impersona: da superutente auth.uid() è
-- nullo e l'autorizzazione non verrebbe mai esercitata.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000',
  'e0000000-0000-0000-0000-00000000000a', 'authenticated', 'authenticated',
  '390000000009', now(), '', '', '', '', now(), now());
insert into public.facility_admins (facility_id, user_id)
  values ('11111111-1111-1111-1111-111111111111',
          'e0000000-0000-0000-0000-00000000000a');

set local role authenticated;
set local request.jwt.claims to '{"sub":"e0000000-0000-0000-0000-00000000000a","role":"authenticated"}';
```

In `004` l'ultima asserzione riguarda una seconda struttura, `99999999-9999-9999-9999-999999999999`: aggiungi anche

```sql
insert into public.facility_admins (facility_id, user_id)
  values ('99999999-9999-9999-9999-999999999999',
          'e0000000-0000-0000-0000-00000000000a');
```

subito dopo la creazione di quella struttura. Prima di `select * from finish();`, in entrambi i file, aggiungi `reset role;`.

- [ ] **Step 5: Aggiornare i messaggi d'errore del client**

In `src/admin/useCreateBooking.ts`, dentro `MESSAGES`:

```ts
  PS012: 'Devi accedere per prenotare.',
  PS013: 'Non puoi prenotare a nome di un altro.',
```

- [ ] **Step 6: Eseguire tutti i test e verificare che passino**

```bash
npm run db:reset && npm run test:db && npm run test
```
Atteso: tutte le suite verdi, incluse `004` e `006` adeguate.

- [ ] **Step 7: Verificare a mano che il buco sia chiuso**

Con lo stack in piedi, ripeti l'attacco che l'ha rivelato: accedi come `+393394128807` (non amministratore), prendi l'id di una prenotazione altrui dal database e chiama la RPC.

```bash
curl -s -X POST "http://127.0.0.1:54321/rest/v1/rpc/cancel_booking" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"p_booking_id":"<id altrui>","p_reason":"prova"}'
```
Atteso: `{"code":"PS013", ... "Non puoi disdire la prenotazione di un altro."}` e la prenotazione ancora `active`.

- [ ] **Step 8: Commit**

```bash
npm run types
git add -A
git commit -m "fix(db): le RPC di prenotazione autorizzano il chiamante"
```

---

### Task 2: Accesso con Google

**Files:**
- Modify: `supabase/config.toml`
- Modify: `src/auth/LoginPage.tsx`
- Create: `src/auth/LoginPage.test.tsx`
- Create: `.env.local.example` (aggiunta di due chiavi)

**Interfaces:**
- Consumes: `supabase` da `src/lib/supabase.ts`
- Produces: `toE164(raw: string): string` (già esistente, ora coperta da test); pulsante «Continua con Google» in `LoginPage`

- [ ] **Step 1: Scrivere i test che falliscono**

`src/auth/LoginPage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage, toE164 } from './LoginPage'
import * as tenant from '../tenant/FacilityProvider'

describe('toE164', () => {
  it('aggiunge il prefisso italiano a un numero nazionale', () => {
    expect(toE164('347 220 15 63')).toBe('+393472201563')
  })
  it('non lo raddoppia se c’è già', () => {
    expect(toE164('39 347 220 15 63')).toBe('+393472201563')
  })
  it('accetta la forma con doppio zero', () => {
    expect(toE164('0039 347 220 15 63')).toBe('+393472201563')
  })
})

describe('LoginPage', () => {
  it('offre Google come prima strada e l’SMS come ripiego', () => {
    vi.spyOn(tenant, 'useFacility').mockReturnValue(
      { id: 'f1', name: 'Palacalcetto', address: 'Alba' } as never)
    render(<LoginPage />)
    expect(screen.getByRole('button', { name: /continua con google/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/numero di telefono/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

```bash
npm run test
```
Atteso: FAIL, il pulsante Google non esiste.

- [ ] **Step 3: Abilitare Google in `supabase/config.toml`**

Sotto `[auth.external.apple]`, che resta `enabled = false`, aggiungi:

```toml
# Porta principale per i clienti: gratuita, mentre ogni SMS si paga.
# Le credenziali arrivano da un progetto Google Cloud e non stanno in questo
# file: si leggono dall'ambiente.
[auth.external.google]
enabled = true
client_id = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID)"
secret = "env(SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET)"
skip_nonce_check = true
```

In `.env.local.example` aggiungi le due chiavi vuote e ricorda nel README locale che senza credenziali il pulsante Google in locale non completa il giro: si prova con l'SMS di test.

- [ ] **Step 4: Aggiungere il pulsante a `LoginPage.tsx`**

Markup come da `docs/mockups/02-catalogo-schermate.html`, blocchi `.oauth`, `.obtn`, `.orline`. Sopra il campo del telefono, non sotto: è la strada che vogliamo far prendere.

```tsx
async function signInWithGoogle() {
  setError(null)
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/prenota` },
  })
  if (error) setError('Non siamo riusciti ad aprire l’accesso con Google.')
}
```

Il separatore fra i due percorsi porta la parola «oppure», come nel mockup. Il pulsante Apple **non** va aggiunto: richiede un account a pagamento che arriva in fase 4.

- [ ] **Step 5: Eseguire i test e verificare che passino**

```bash
npm run test
```
Atteso: PASS su tutti e quattro i casi.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(auth): accesso con Google, SMS come ripiego"
```

---

### Task 3: Il telefono verificato e la scheda cliente

**Files:**
- Create: `supabase/migrations/0012_member_identity.sql`
- Create: `supabase/tests/008_member_identity.test.sql`
- Create: `src/auth/ClaimPhoneDialog.tsx`
- Create: `src/auth/useMyMember.ts`

**Interfaces:**
- Consumes: `owns_member(uuid)` dal Task 1
- Produces:
  - `claim_members_by_verified_phone() returns setof public.members`
  - `ensure_my_member(p_facility uuid) returns uuid`
  - `useMyMember(): { memberId: string | null; isPending: boolean }`

- [ ] **Step 1: Scrivere il test che fallisce**

`supabase/tests/008_member_identity.test.sql`:

```sql
begin;
select plan(4);

insert into public.facilities (id, slug, name) values
  ('c0000000-0000-0000-0000-00000000aa01', 'uno', 'Uno'),
  ('c0000000-0000-0000-0000-00000000aa02', 'due', 'Due');

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values ('00000000-0000-0000-0000-000000000000',
  'c0000000-0000-0000-0000-00000000bb01', 'authenticated', 'authenticated',
  '393472201563', now(), '', '', '', '', now(), now());

-- due schede create dal gestore al telefono, in due strutture diverse
insert into public.members (facility_id, name, phone) values
  ('c0000000-0000-0000-0000-00000000aa01', 'Marco Ferrero', '3472201563'),
  ('c0000000-0000-0000-0000-00000000aa02', 'Marco Ferrero', '347 220 15 63');
-- e una di un'altra persona, che non deve essere toccata
insert into public.members (facility_id, name, phone) values
  ('c0000000-0000-0000-0000-00000000aa01', 'Altro', '3331234567');

set local role authenticated;
set local request.jwt.claims to '{"sub":"c0000000-0000-0000-0000-00000000bb01","role":"authenticated"}';

select is(
  (select count(*)::integer from public.claim_members_by_verified_phone()),
  2, 'rivendica le due schede con quel numero, anche scritto con gli spazi'
);

select is(
  (select count(*)::integer from public.members
    where user_id = 'c0000000-0000-0000-0000-00000000bb01'),
  2, 'le schede risultano collegate all account'
);

select is(
  (select user_id from public.members where name = 'Altro'),
  null, 'la scheda di un altro non viene toccata'
);

-- in una struttura dove non ha nulla, ensure_my_member crea la scheda
insert into public.facilities (id, slug, name)
  values ('c0000000-0000-0000-0000-00000000aa03', 'tre', 'Tre');
select isnt(
  (select public.ensure_my_member('c0000000-0000-0000-0000-00000000aa03')),
  null, 'ensure_my_member crea la scheda se non c e'
);

reset role;
select * from finish();
rollback;
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test:db
```
Atteso: FAIL, `function public.claim_members_by_verified_phone() does not exist`.

- [ ] **Step 3: Scrivere `0012_member_identity.sql`**

```sql
-- Le ultime dieci cifre di un numero: i cellulari italiani ne hanno dieci, e
-- il gestore scrive «347 220 15 63» mentre gotrue salva «393472201563».
-- Confrontare le stringhe intere significherebbe non trovare mai niente.
create or replace function public.phone_key(p_phone text)
returns text
language sql
immutable
as $$
  select nullif(right(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g'), 10), '');
$$;

-- Rivendicazione. Nessun parametro, per costruzione: un parametro sarebbe una
-- stringa mandata dal client, cioè esattamente ciò da cui la verifica protegge.
-- Il numero si legge da auth.users, dove l'ha scritto Supabase dopo il codice.
create or replace function public.claim_members_by_verified_phone()
returns setof public.members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_key text;
begin
  if auth.uid() is null then
    raise exception 'Devi accedere.' using errcode = 'PS012';
  end if;

  select public.phone_key(u.phone) into v_key
    from auth.users u
   where u.id = auth.uid() and u.phone_confirmed_at is not null;

  if v_key is null then
    raise exception 'Il numero non è ancora verificato.' using errcode = 'PS014';
  end if;

  return query
  update public.members m
     set user_id = auth.uid()
   where m.user_id is null
     and public.phone_key(m.phone) = v_key
     -- Un account ha al massimo una scheda per struttura: senza questo filtro
     -- la rivendicazione violerebbe members_facility_user_uniq e fallirebbe
     -- tutta, invece di collegare quello che può.
     and not exists (
       select 1 from public.members x
       where x.facility_id = m.facility_id and x.user_id = auth.uid()
     )
  returning m.*;
end;
$$;

-- La scheda dell'utente in questa struttura, creandola se non c'è.
-- Serve a chi entra con Google e non ha mai telefonato: senza una scheda non
-- esiste nessun member_id da passare a create_booking.
create or replace function public.ensure_my_member(p_facility uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user auth.users;
begin
  if auth.uid() is null then
    raise exception 'Devi accedere.' using errcode = 'PS012';
  end if;

  select id into v_id from public.members
   where facility_id = p_facility and user_id = auth.uid();
  if found then
    return v_id;
  end if;

  select * into v_user from auth.users where id = auth.uid();

  insert into public.members (facility_id, user_id, name, phone, email)
  values (
    p_facility,
    auth.uid(),
    coalesce(nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''),
             nullif(trim(v_user.raw_user_meta_data->>'name'), ''),
             'Cliente'),
    public.phone_key(v_user.phone),
    v_user.email
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.claim_members_by_verified_phone() to authenticated;
grant execute on function public.ensure_my_member(uuid) to authenticated;
```

- [ ] **Step 4: Eseguire il test e verificare che passi**

```bash
npm run db:reset && npm run test:db
```
Atteso: `# All 4 tests passed`.

- [ ] **Step 5: Implementare `useMyMember.ts`**

```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthProvider'
import { useFacility } from '../tenant/FacilityProvider'

/** La scheda dell'utente in questa struttura. Null se non ha fatto accesso. */
export function useMyMember() {
  const { session } = useAuth()
  const facility = useFacility()

  const { data, isPending } = useQuery({
    queryKey: ['my-member', facility.id, session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ensure_my_member', {
        p_facility: facility.id,
      })
      if (error) throw error
      return data as string
    },
  })

  return { memberId: data ?? null, isPending: !!session && isPending }
}
```

- [ ] **Step 6: Implementare `ClaimPhoneDialog.tsx`**

Si apre dopo il primo accesso, quando `session.user.phone` è vuoto. Due passaggi nello stesso riquadro, con il markup del `Dialog` esistente:

```tsx
// 1. manda il codice al numero digitato
await supabase.auth.updateUser({ phone: toE164(phone) })
// 2. conferma: Supabase scrive il numero verificato su auth.users
await supabase.auth.verifyOtp({ phone: toE164(phone), token: code, type: 'phone_change' })
// 3. solo ora si rivendica: la funzione legge il numero dal token, non da qui
const { data } = await supabase.rpc('claim_members_by_verified_phone')
```

Se `data` non è vuoto, mostra cosa si sta ereditando prima di chiudere: *«Abbiamo ritrovato le tue prenotazioni: N schede collegate»*. Se è vuoto, chiudi senza dire nulla — non c'era storico, e non è un errore.

- [ ] **Step 7: Verificare a mano**

`npm run dev`, accedi col numero di test `347 220 15 63`, e verifica che le prenotazioni di Marco Ferrero del seed compaiano come tue.

- [ ] **Step 8: Commit**

```bash
npm run types
git add -A
git commit -m "feat(auth): telefono verificato e ricongiungimento dello storico"
```

---

### Task 4: Rotte pubbliche e pannello a caricamento pigro

**Files:**
- Modify: `src/App.tsx`
- Create: `src/public/HomePage.tsx`

**Interfaces:**
- Produces: rotte `/`, `/prenota`, `/prenotazioni`, `/prenotazioni/:id`, `/accedi`; `/admin` caricato con `lazy()`

- [ ] **Step 1: Rendere pigro il pannello**

In `src/App.tsx`:

```tsx
import { lazy, Suspense } from 'react'

const AdminPage = lazy(() =>
  import('./admin/AdminPage').then((m) => ({ default: m.AdminPage })))
```

e avvolgi le rotte in `<Suspense fallback={<div className="p-8 text-muted">Caricamento…</div>}>`.

Chi apre la home non scarica più la griglia, i dialoghi e le ricorrenze.

- [ ] **Step 2: Dichiarare le rotte**

```tsx
<Routes>
  <Route path="/" element={<HomePage />} />
  <Route path="/accedi" element={<LoginPage />} />
  <Route path="/prenota" element={<BookPage />} />
  <Route path="/prenotazioni" element={<MyBookingsPage />} />
  <Route path="/prenotazioni/:id" element={<BookingPage />} />
  <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
</Routes>
```

Le rotte dei Task 5-9 non esistono ancora: creale come componenti vuoti che rendono `null`, così la navigazione funziona e i task successivi le riempiono.

- [ ] **Step 3: Implementare `HomePage.tsx`**

Markup come da `docs/mockups/02-catalogo-schermate.html`, area cliente. Contiene: nome e contatti della struttura da `useFacility()`, i campi con tipo e copertura, e un invito a `/prenota`. Nessuna query nuova: i campi arrivano da `useFields()`, già esistente in `src/admin/DayGrid.hooks.ts`.

- [ ] **Step 4: Verificare che il pacchetto si sia diviso**

```bash
npm run build
```
Atteso: più di un file `.js` in `dist/assets/`, e il principale più piccolo dei 469 kB della fase 1A.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(app): rotte pubbliche e pannello a caricamento pigro"
```

---

### Task 5: Il calcolo delle fasce libere

**Files:**
- Create: `src/public/freeSlots.ts`
- Create: `src/public/freeSlots.test.ts`

**Interfaces:**
- Produces: `freeSlots(input: FreeSlotsInput): number[]` — minuti di inizio delle fasce prenotabili

- [ ] **Step 1: Scrivere i test che falliscono**

`src/public/freeSlots.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { freeSlots } from './freeSlots'

const base = { openMin: 15 * 60, closeMin: 24 * 60, stepMin: 30, durationMin: 60 }

describe('freeSlots', () => {
  it('senza occupazioni offre tutte le partenze che ci stanno', () => {
    // 15:00 … 23:00 ogni mezz'ora: l'ultima partenza è quella che finisce alle 24:00
    expect(freeSlots({ ...base, busy: [] })).toHaveLength(17)
    expect(freeSlots({ ...base, busy: [] })[0]).toBe(900)
    expect(freeSlots({ ...base, busy: [] }).at(-1)).toBe(1380)
  })

  it('toglie le partenze che si sovrappongono a una prenotazione', () => {
    // occupato 20:00–21:30: cadono le partenze 19:30, 20:00, 20:30, 21:00
    const out = freeSlots({ ...base, busy: [[1200, 1290]] })
    expect(out).not.toContain(1170)
    expect(out).not.toContain(1200)
    expect(out).not.toContain(1260)
    expect(out).toContain(1140)
    expect(out).toContain(1290)
  })

  it('gli estremi si toccano ma non si sovrappongono', () => {
    // una prenotazione 20:00–21:00 lascia libera la partenza delle 21:00
    expect(freeSlots({ ...base, busy: [[1200, 1260]] })).toContain(1260)
  })

  it('una durata più lunga riduce le partenze possibili', () => {
    expect(freeSlots({ ...base, durationMin: 120, busy: [] }).at(-1)).toBe(1320)
  })

  it('non offre partenze già passate se il giorno è oggi', () => {
    const out = freeSlots({ ...base, busy: [], nowMin: 19 * 60 + 10 })
    expect(out[0]).toBe(1170)  // 19:30, la prima mezz'ora dopo le 19:10
  })
})
```

- [ ] **Step 2: Eseguire i test e verificare che falliscano**

```bash
npm run test
```
Atteso: FAIL, `Cannot find module './freeSlots'`.

- [ ] **Step 3: Implementare `freeSlots.ts`**

```ts
export type FreeSlotsInput = {
  openMin: number
  closeMin: number
  stepMin: number
  durationMin: number
  /** intervalli occupati in minuti da mezzanotte, estremo destro escluso */
  busy: [number, number][]
  /** se il giorno mostrato è oggi, i minuti già passati */
  nowMin?: number
}

/**
 * Le partenze prenotabili di una giornata su un campo.
 *
 * Il confronto è semiaperto come il `tstzrange` del database: una prenotazione
 * che finisce alle 21:00 lascia libera la partenza delle 21:00. Se qui fosse
 * chiuso, il cliente vedrebbe meno slot di quanti il database ne accetta, e
 * nessuno capirebbe perché.
 *
 * Non decide niente: il database resta l'unico a stabilire se una prenotazione
 * si può fare. Questa funzione evita al cliente di provarci invano.
 */
export function freeSlots(input: FreeSlotsInput): number[] {
  const { openMin, closeMin, stepMin, durationMin, busy, nowMin } = input
  const out: number[] = []

  for (let start = openMin; start + durationMin <= closeMin; start += stepMin) {
    if (nowMin !== undefined && start < nowMin) continue
    const end = start + durationMin
    const collide = busy.some(([bs, be]) => start < be && end > bs)
    if (!collide) out.push(start)
  }

  return out
}
```

- [ ] **Step 4: Eseguire i test e verificare che passino**

```bash
npm run test
```
Atteso: PASS su tutti e cinque i casi.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(cliente): calcolo delle fasce libere"
```

---

### Task 6: La schermata Prenota

**Files:**
- Create: `src/public/BookPage.hooks.ts`
- Create: `src/public/BookPage.tsx`

**Interfaces:**
- Consumes: `freeSlots()` dal Task 5, `useFields()` da `src/admin/DayGrid.hooks.ts`, `parseRange()` idem
- Produces: `useAvailability(day: Date, fieldId: string | null): { busy: [number, number][]; isPending: boolean }`

- [ ] **Step 1: Implementare `BookPage.hooks.ts`**

Legge la vista pubblica, non la tabella: funziona anche senza account.

```ts
import { useQuery } from '@tanstack/react-query'
import { endOfDay, startOfDay } from 'date-fns'
import { supabase } from '../lib/supabase'
import { minutesOfDay } from '../lib/tz'
import { useFacility } from '../tenant/FacilityProvider'
import { parseRange } from '../admin/DayGrid.hooks'

export function useAvailability(day: Date, fieldId: string | null) {
  const facility = useFacility()

  const { data, isPending } = useQuery({
    queryKey: ['busy', facility.id, fieldId, startOfDay(day).toISOString()],
    enabled: !!fieldId,
    queryFn: async (): Promise<[number, number][]> => {
      const { data, error } = await supabase
        .from('busy_slots')
        .select('slot')
        .eq('facility_id', facility.id)
        .eq('field_id', fieldId!)
        .overlaps('slot', `[${startOfDay(day).toISOString()},${endOfDay(day).toISOString()})`)
      if (error) throw error
      return data.map((r) => {
        const [s, e] = parseRange(r.slot as unknown as string)
        // una prenotazione che finisce a mezzanotte vale 1440, non 0
        const end = minutesOfDay(e) === 0 ? 1440 : minutesOfDay(e)
        return [minutesOfDay(s), end] as [number, number]
      })
    },
  })

  return { busy: data ?? [], isPending }
}
```

- [ ] **Step 2: Implementare `BookPage.tsx`**

Markup come da `docs/mockups/02-catalogo-schermate.html`, schermata **Prenota** (`/prenota`), con il componente `daystrip` per i giorni. Tre scelte in sequenza: campo, giorno, ora. Le fasce vengono da `freeSlots()`, il prezzo da `price_bands` (lettura pubblica), la durata da tre pulsanti come nel dialogo del gestore.

Chi non ha fatto accesso vede tutto: il pulsante di conferma porta a `/accedi` e torna qui.

- [ ] **Step 3: Verificare a mano, da anonimo**

Apri `/prenota` in una finestra anonima. Atteso: si vedono campi, giorni, fasce e prezzi senza aver fatto accesso; le fasce occupate dal seed non compaiono.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cliente): schermata di prenotazione con disponibilità pubblica"
```

---

### Task 7: Confermare la prenotazione

**Files:**
- Create: `src/public/ConfirmBookingDialog.tsx`
- Create: `src/public/useBookAsMember.ts`
- Create: `src/public/useBookAsMember.test.ts`

**Interfaces:**
- Consumes: `useMyMember()` dal Task 3, `create_booking` dal Task 1, `slotRange()` da `src/lib/tz.ts`
- Produces: `useBookAsMember(): { mutateAsync, isPending }`

- [ ] **Step 1: Scrivere il test che fallisce**

`src/public/useBookAsMember.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { messageForCustomer } from './useBookAsMember'

describe('messageForCustomer', () => {
  it('la collisione diventa una frase, non un codice', () => {
    expect(messageForCustomer('PS004'))
      .toBe('Qualcuno ha appena preso questo slot. Scegline un altro.')
  })
  it('spiega l’orizzonte invece di dire di no', () => {
    expect(messageForCustomer('PS007'))
      .toMatch(/non si può ancora prenotare così avanti/i)
  })
  it('ha un messaggio di riserva', () => {
    expect(messageForCustomer('ZZZZZ')).toMatch(/non è riuscita/i)
  })
})
```

- [ ] **Step 2: Eseguire il test e verificare che fallisca**

```bash
npm run test
```
Atteso: FAIL, `Cannot find module './useBookAsMember'`.

- [ ] **Step 3: Implementare `useBookAsMember.ts`**

I messaggi sono diversi da quelli del gestore: lo stesso codice, letto da un cliente, deve dire cosa fare adesso, non cosa è andato storto.

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { slotRange } from '../lib/tz'

const MESSAGES: Record<string, string> = {
  PS003: 'Il campo è chiuso in quell’orario.',
  PS004: 'Qualcuno ha appena preso questo slot. Scegline un altro.',
  PS005: 'A quell’ora l’impianto è chiuso.',
  PS006: 'Quell’orario è già passato.',
  PS007: 'Non si può ancora prenotare così avanti nel tempo.',
  PS008: 'La durata è inferiore al minimo consentito.',
  PS012: 'Devi accedere per prenotare.',
  PS013: 'Non puoi prenotare a nome di un altro.',
}

export function messageForCustomer(code: string): string {
  return MESSAGES[code] ?? 'La prenotazione non è riuscita. Riprova.'
}

export type CustomerBooking = {
  fieldId: string
  day: string
  startMin: number
  minutes: number
  memberId: string
}

export function useBookAsMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CustomerBooking) => {
      const { data, error } = await supabase.rpc('create_booking', {
        p_field_id: input.fieldId,
        p_slot: slotRange(input.day, input.startMin, input.minutes),
        p_member_id: input.memberId,
        // Il database lo forza comunque a 'app' per chi non è gestore:
        // qui è solo esplicito, non è lì che si difende.
        p_source: 'app',
      })
      if (error) throw new Error(messageForCustomer(error.code ?? ''))
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['busy'] })
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
    },
  })
}
```

- [ ] **Step 4: Implementare `ConfirmBookingDialog.tsx`**

Markup come da mockup, `/prenota/conferma`. Mostra campo, giorno, orario, durata e **quanto si paga in struttura**, poi conferma. Se manca l'accesso, il pulsante lo chiede e torna qui con la scelta intatta.

- [ ] **Step 5: Provare la collisione**

Con due finestre, prenota lo stesso slot: una da `/prenota` come cliente, l'altra da `/admin` come gestore. La seconda deve leggere *«Qualcuno ha appena preso questo slot»*, e la griglia del gestore mostrare la prima in tempo reale.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(cliente): conferma della prenotazione"
```

---

### Task 8: Le tue prenotazioni

**Files:**
- Create: `src/public/MyBookingsPage.tsx`
- Create: `src/public/MyBookingsPage.hooks.ts`

**Interfaces:**
- Produces: il tipo `MyBooking` e `useMyBookings(): { future: MyBooking[]; past: MyBooking[]; isPending: boolean }`

`MyBooking` è un tipo suo, non il `BookingRow` di `src/admin/DayGrid.hooks.ts`: quello porta nome e telefono del cliente perché serve al gestore, questo porta il nome del campo perché serve a chi ha prenotato. Riusarlo obbligherebbe a riempire di `null` metà delle sue proprietà.

- [ ] **Step 1: Implementare `MyBookingsPage.hooks.ts`**

La policy `bookings_read_own` della fase 1A fa già il lavoro: una `select` senza filtri restituisce solo le proprie.

```ts
export type MyBooking = {
  id: string
  field_name: string
  field_kind: string
  slot_start: Date
  slot_end: Date
  status: string
  price_cents: number
  cancel_deadline: string
}

const { data, error } = await supabase
  .from('bookings')
  .select('id, slot, status, price_cents, cancel_deadline, fields(name, kind)')
  .order('slot', { ascending: false })
```

Converti ogni riga con `parseRange()` di `src/admin/DayGrid.hooks.ts`, come fa la griglia.

Dividi in future e passate confrontando `slot_start` con adesso. Le disdette restano visibili fra le passate, con l'etichetta: sparire non è la stessa cosa che essere disdetta, e il cliente deve ritrovarle.

- [ ] **Step 2: Implementare `MyBookingsPage.tsx`**

Markup come da mockup. Vuoto significativo se non ce ne sono: *«Non hai ancora prenotazioni. Guarda i campi liberi →»*, non una pagina bianca.

- [ ] **Step 3: Verificare a mano**

Accedi col numero di test, rivendica lo storico, e verifica che le prenotazioni del seed compaiano.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(cliente): le tue prenotazioni"
```

---

### Task 9: Dettaglio e disdetta lato cliente

**Files:**
- Create: `src/public/BookingPage.tsx`

**Interfaces:**
- Consumes: `useCancelBooking()` e `isLateCancel()` da `src/admin/useCancelBooking.ts`, `cancel_booking` corretta dal Task 1

- [ ] **Step 1: Implementare `BookingPage.tsx`**

Markup come da `docs/mockups/02-catalogo-schermate.html`, sezione **Dettaglio prenotazione** (`/prenotazioni/8f3c`). Mostra campo, giorno, orario, importo da pagare in struttura e la scadenza di disdetta.

Il gancio `useCancelBooking` esiste già e non va duplicato. Cambia solo la frase, perché il lettore è un altro:

```tsx
{late
  ? 'Siamo oltre il termine: la prenotazione risulterà come mancata presenza e inciderà sulla tua affidabilità.'
  : 'Disdici entro il termine e non paghi nulla: il campo torna libero per gli altri.'}
```

- [ ] **Step 2: Verificare che un cliente non possa disdire quella di un altro**

Con l'id di una prenotazione altrui nell'indirizzo, la pagina deve dire che non esiste — la RLS non la mostra — e la RPC rifiutare con `PS013` se qualcuno la chiama comunque.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(cliente): dettaglio della prenotazione e disdetta"
```

---

### Task 10: PWA installabile

**Files:**
- Modify: `package.json`, `vite.config.ts`
- Create: `public/icon-192.png`, `public/icon-512.png`

**Interfaces:**
- Produces: manifest e service worker generati in `dist/`

> **Nota:** la specifica della fase 1B non nomina la PWA — la elenca la specifica di progetto, nel perimetro della fase 1. L'ho collocata qui perché è l'esperienza di installazione del cliente, non del gestore. Se preferisci rimandarla, salta il task: nessun altro dipende da esso.

- [ ] **Step 1: Installare il plugin**

```bash
npm install -D vite-plugin-pwa
```

- [ ] **Step 2: Configurare `vite.config.ts`**

```ts
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Palacalcetto · Prenota Campi',
    short_name: 'Palacalcetto',
    start_url: '/prenota',
    display: 'standalone',
    background_color: '#ECEFE9',
    theme_color: '#146B3F',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  },
})
```

Il nome della struttura è scritto a mano di proposito: il manifest è statico e viene servito prima che l'app sappia di quale struttura si tratta. Diventerà dinamico quando ci sarà un secondo cliente, non prima.

- [ ] **Step 3: Verificare**

```bash
npm run build && npm run preview
```
Nel browser, scheda Application: il manifest è valido e il service worker registrato. Su telefono compare «Aggiungi a schermata Home».

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(app): installabile come PWA"
```

---

## Fine della fase 1B · App cliente

Al termine un giocatore apre l'indirizzo dell'impianto, vede quali campi sono liberi senza account, entra con Google, ritrova le prenotazioni fatte per telefono negli anni, prenota e disdice da solo. Le RPC autorizzano chi le chiama, e i test lo provano impersonando un utente invece di girare da superutente.

**Cosa resta della fase 1:** configurazione dell'impianto dall'interfaccia — campi, tariffe, chiusure, orari di apertura, impostazioni, feature flag, anagrafica con fusione dei doppioni — e comunicazione: bacheca avvisi e notifiche di promemoria. Più il backup notturno, che è un task a sé e non aspetta nessuno.

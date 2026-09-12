# The customer's account and contact details — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the customer app a profile tab where someone can see how they sign in, add or change an email address, attach Google to the account they already have, and sign out — which the app cannot do at all today.

**Architecture:** Everything here is client-side plus one small SQL change. The email is added through Supabase's own `updateUser`, which sends a confirmation and leaves the address *pending* until the link is clicked; Google is attached with `linkIdentity`, a beta feature that must be enabled in the project's auth settings. The one database change makes `ensure_my_member` refresh `members.email` from the account's verified address, so a customer who adds one later is actually reachable.

**Tech Stack:** React 19 · TypeScript · Vite 8 · Tailwind 4 · TanStack Query v5 · React Router 7 · Supabase (Auth + Postgres 17, RLS, pgTAP) · Vitest

**Spec:** `docs/superpowers/specs/2026-09-12-account-and-contacts-design.md`

## Global Constraints

- **English in the repository** — commit messages, code comments, documentation, branch names. **Italian for every string a user reads** and for test descriptions.
- **`npx tsc --noEmit` checks nothing in this repo** — the root tsconfig has `"files": []`. The real typecheck is **`npx tsc -b`**.
- `erasableSyntaxOnly` is set: TypeScript parameter properties are forbidden.
- **Every mutation proves it wrote** — a write excluded by an RLS `using` clause matches zero rows and returns no error, so it asks for the affected row back.
- **Queries live in `hooks/`**, one hook per file, named `use…`; pure logic in `utils/`. Imports use `@/…` when crossing a feature boundary or reaching `shared/`; relative paths only within the same folder.
- Form controls use the **`.field`** class from `src/index.css`. Touch targets meant for a finger are **44×44 under the `pointer-coarse:` variant** (`AdminPage.tsx` carries the idiom).
- Money in cents, times in minutes from midnight, every instant `timestamptz`, reference zone `Europe/Rome`.
- Never `git push`, never open a PR. Never `pkill` on a pattern — terminate only an exact PID whose `/proc/<pid>/cwd` you verified. Never `docker … prune`; stop Supabase only with `npm run db:stop`.

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
| `supabase/migrations/0023_member_email_refresh.sql` | `ensure_my_member` refreshes `members.email` |
| `supabase/tests/017_member_email_refresh.test.sql` | the refresh, and that adoption is untouched |
| `src/features/auth/utils/accountMessages.ts` | auth errors → Italian sentences |
| `src/features/auth/hooks/useSignOut.ts` | the way out |
| `src/features/auth/hooks/useUpdateEmail.ts` | add or change the address, and its pending state |
| `src/features/auth/hooks/useLinkGoogle.ts` | attach a Google identity |
| `src/features/auth/components/ProfilePage.tsx` | the screen |
| `src/shared/components/ui/MobileTabBar.tsx` | **modified**: a fourth tab |
| `src/App.tsx` | **modified**: the `/profilo` route |
| `docs/come-provare.md` | **modified**: the confirmation round-trip, by hand |

`ProfilePage` composes the hooks and owns no query of its own beyond them. That is what lets every rendering rule — pending address, Google already attached, signed out — be tested without a network.

---

## Task 1: `ensure_my_member` refreshes the card's email

**Files:**
- Create: `supabase/migrations/0023_member_email_refresh.sql`
- Create: `supabase/tests/017_member_email_refresh.test.sql`

**Interfaces:**
- Consumes: `public.ensure_my_member(p_facility uuid) returns uuid` from `0016_member_adoption.sql`.
- Produces: the same signature. Callers do not change.

Spec §2.4: the email is copied once, at creation. A customer who adds an address later keeps an empty card, and the next sub-project would look there and find nothing.

- [ ] **Step 1: Write the failing pgTAP test**

Create `supabase/tests/017_member_email_refresh.test.sql`:

```sql
begin;
select plan(4);

insert into public.facilities (id, slug, name, booking_horizon_days) values
  ('e4000000-0000-0000-0000-0000000000f1', 'test-mail-sync', 'Test Recapiti', 3650);

insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at, email,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  -- Ha confermato un indirizzo DOPO che la scheda era gia' nata.
  ('00000000-0000-0000-0000-000000000000','e4000000-0000-0000-0000-0000000000aa',
   'authenticated','authenticated','393334445566', now(), 'rossi@example.com',
   '','','','', now(), now()),
  -- Nessun indirizzo: la scheda non deve essere toccata.
  ('00000000-0000-0000-0000-000000000000','e4000000-0000-0000-0000-0000000000bb',
   'authenticated','authenticated','393337778899', now(), null,
   '','','','', now(), now());

-- Due schede gia' esistenti, create dal gestore e gia' rivendicate.
insert into public.members (id, facility_id, user_id, name, phone, email) values
  ('e4000000-0000-0000-0000-0000000000c1','e4000000-0000-0000-0000-0000000000f1',
   'e4000000-0000-0000-0000-0000000000aa','Rossi','3334445566', null),
  ('e4000000-0000-0000-0000-0000000000c2','e4000000-0000-0000-0000-0000000000f1',
   'e4000000-0000-0000-0000-0000000000bb','Bianchi','3337778899', 'vecchia@example.com');

-- Una scheda senza account, con un numero che corrisponde a un terzo utente:
-- serve a provare che l'adozione continua a funzionare come prima.
insert into auth.users (instance_id, id, aud, role, phone, phone_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  created_at, updated_at)
values
  ('00000000-0000-0000-0000-000000000000','e4000000-0000-0000-0000-0000000000cc',
   'authenticated','authenticated','393331112233', now(), '','','','', now(), now());
insert into public.members (id, facility_id, name, phone) values
  ('e4000000-0000-0000-0000-0000000000c3','e4000000-0000-0000-0000-0000000000f1',
   'Verdi','3331112233');

set local role authenticated;

set local request.jwt.claims to '{"sub":"e4000000-0000-0000-0000-0000000000aa","role":"authenticated"}';
select is(
  (select email from public.members
    where id = (select public.ensure_my_member('e4000000-0000-0000-0000-0000000000f1'))),
  'rossi@example.com',
  'una scheda senza indirizzo riceve quello confermato sull''account');

set local request.jwt.claims to '{"sub":"e4000000-0000-0000-0000-0000000000bb","role":"authenticated"}';
select is(
  (select email from public.members
    where id = (select public.ensure_my_member('e4000000-0000-0000-0000-0000000000f1'))),
  'vecchia@example.com',
  'un account senza indirizzo non cancella quello gia'' sulla scheda');

set local request.jwt.claims to '{"sub":"e4000000-0000-0000-0000-0000000000cc","role":"authenticated"}';
select is(
  public.ensure_my_member('e4000000-0000-0000-0000-0000000000f1'),
  'e4000000-0000-0000-0000-0000000000c3'::uuid,
  'l''adozione per numero verificato continua a funzionare');

select is(
  (select count(*)::integer from public.members
    where facility_id = 'e4000000-0000-0000-0000-0000000000f1'),
  3,
  'nessuna scheda in piu'' e'' stata creata da queste chiamate');

select * from finish();
rollback;
```

Note the second assertion: an account with **no** address must not wipe an address already on the card. `is distinct from` alone would overwrite it with null.

- [ ] **Step 2: Run it and watch it fail**

Run: `npm run test:db`
Expected: assertion 1 fails — the card keeps `null` because nothing refreshes it. Assertions 2, 3 and 4 pass already; they are the controls that prove the change does not break what works.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0023_member_email_refresh.sql`:

```sql
-- `ensure_my_member` copied the account's email once, when it created the card.
-- A customer who signs in with the SMS code has no address at that moment and
-- adds one later from the profile screen — and the card stayed empty, so the
-- notification work would look there and find nobody to write to.
--
-- The refresh rides on the existing early return: this function already runs
-- every time a customer uses the app, so the value catches up on their next
-- visit. A trigger on `auth.users` would be instant, but this project has never
-- reached into the auth schema and should not start for a field that can be a
-- few minutes stale (spec §2.4).
--
-- `u.email is not null` matters as much as `is distinct from`: an account with
-- no address must not erase an address the card already holds.
create or replace function public.ensure_my_member(p_facility uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_user auth.users;
  v_key text;
begin
  if auth.uid() is null then
    raise exception 'Devi accedere.' using errcode = 'PS012';
  end if;

  select id into v_id from public.members
   where facility_id = p_facility and user_id = auth.uid();
  if found then
    update public.members m
       set email = u.email
      from auth.users u
     where m.id = v_id
       and u.id = auth.uid()
       and u.email is not null
       and m.email is distinct from u.email;
    return v_id;
  end if;

  select * into v_user from auth.users where id = auth.uid();

  -- Solo il numero confermato da Supabase conta: `phone` senza
  -- `phone_confirmed_at` e' una stringa che nessuno ha verificato, e
  -- ereditare una scheda e' ereditarne storico e affidabilita' (spec §2.2).
  if v_user.phone_confirmed_at is not null then
    v_key := public.phone_key(v_user.phone);
  end if;

  -- Adozione. La scheda che il gestore ha creato al telefono, ancora senza
  -- account, con lo stesso numero verificato di chi sta entrando: e' sua.
  -- Prima di inserire, non dopo — inserire per primo e' esattamente cio' che
  -- rompeva entrambi i percorsi.
  if v_key is not null then
    update public.members m
       set user_id = auth.uid()
     where m.facility_id = p_facility
       and m.user_id is null
       and public.phone_key(m.phone) = v_key
    returning m.id into v_id;

    if v_id is not null then
      return v_id;
    end if;
  end if;

  insert into public.members (facility_id, user_id, name, phone, email)
  values (
    p_facility,
    auth.uid(),
    coalesce(nullif(trim(v_user.raw_user_meta_data->>'full_name'), ''),
             nullif(trim(v_user.raw_user_meta_data->>'name'), ''),
             'Cliente'),
    v_key,
    v_user.email
  )
  returning id into v_id;

  return v_id;
end;
$$;
```

**Before writing this, read the current function in `supabase/migrations/0016_member_adoption.sql` and diff it against the body above.** Everything below the early return must be byte-identical — the adoption path is what every returning customer depends on, and this task adds to it rather than rewriting it. If the current body differs from what is reproduced here in any way other than the added `update`, stop and report.

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm run db:reset && npm run test:db`
Expected: every file passes; the total rises by 4.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0023_member_email_refresh.sql supabase/tests/017_member_email_refresh.test.sql
git commit -m "feat(db): keep a member's email in step with the account's verified one"
```

---

## Task 2: the Italian sentences, and the way out

**Files:**
- Create: `src/features/auth/utils/accountMessages.ts`
- Test: `src/features/auth/utils/accountMessages.test.ts`
- Create: `src/features/auth/hooks/useSignOut.ts`
- Test: `src/features/auth/hooks/useSignOut.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function accountMessage(error: unknown, action: 'email' | 'google' | 'signout'): string
  export function isEmailTaken(error: unknown): boolean

  export function useSignOut(): { signOut: () => Promise<void>; leaving: boolean; error: string | null }
  ```

- [ ] **Step 1: Write the failing message test**

Create `src/features/auth/utils/accountMessages.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { accountMessage, isEmailTaken } from './accountMessages'

describe('accountMessages', () => {
  it('riconosce un indirizzo già usato da un altro account', () => {
    expect(isEmailTaken({ code: 'email_exists' })).toBe(true)
    expect(isEmailTaken({ message: 'A user with this email address has already been registered' }))
      .toBe(true)
    expect(isEmailTaken({ message: 'network error' })).toBe(false)
    expect(isEmailTaken(null)).toBe(false)
  })

  it('dice cosa non è riuscito e cosa si può fare, non cosa ha risposto il servizio', () => {
    expect(accountMessage(new Error('boom'), 'email'))
      .toBe('Non siamo riusciti a salvare l’indirizzo. Riprova.')
    expect(accountMessage(new Error('boom'), 'google'))
      .toBe('Non siamo riusciti a collegare Google. Riprova.')
    expect(accountMessage(new Error('boom'), 'signout'))
      .toBe('Non siamo riusciti a uscire. Riprova.')
  })

  it('sull’indirizzo già preso spiega la situazione invece di dire che è un errore', () => {
    expect(accountMessage({ code: 'email_exists' }, 'email'))
      .toBe('Questo indirizzo è già collegato a un altro account. Entra con quello, oppure usane uno diverso.')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/auth/utils/accountMessages`
Expected: FAIL — cannot resolve `./accountMessages`.

- [ ] **Step 3: Write the messages**

```ts
/**
 * A message the customer reads says what did not happen and what they can do.
 * It never repeats what the service answered: `AuthApiError`'s text is English,
 * written for whoever integrates the API, not for whoever is holding the phone.
 *
 * `memberMessages.ts` and `closureMessages.ts` do the same for their screens and
 * stay separate files on purpose — each maps a different set of failures onto a
 * different set of actions.
 */

/** Supabase refuses a second account on one address; both shapes appear. */
export function isEmailTaken(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false
  const e = error as { code?: string; message?: string }
  return e.code === 'email_exists'
    || (e.message ?? '').includes('already been registered')
}

export function accountMessage(
  error: unknown,
  action: 'email' | 'google' | 'signout',
): string {
  if (action === 'email' && isEmailTaken(error)) {
    return 'Questo indirizzo è già collegato a un altro account. Entra con quello, oppure usane uno diverso.'
  }
  if (action === 'email') return 'Non siamo riusciti a salvare l’indirizzo. Riprova.'
  if (action === 'google') return 'Non siamo riusciti a collegare Google. Riprova.'
  return 'Non siamo riusciti a uscire. Riprova.'
}
```

- [ ] **Step 4: Write the failing sign-out test**

Create `src/features/auth/hooks/useSignOut.test.ts`. Follow the house idiom for hook tests — `.test.ts`, no JSX, `vi.hoisted` + `vi.mock('@/shared/lib/supabase', …)` — modelled on `src/features/admin/hooks/useMemberCard.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { signOut: signOutMock } },
}))

import { useSignOut } from './useSignOut'

describe('useSignOut', () => {
  beforeEach(() => signOutMock.mockReset())

  it('esce chiamando Supabase', async () => {
    signOutMock.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useSignOut())
    await act(() => result.current.signOut())
    expect(signOutMock).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it('se non riesce lo dice in italiano invece di restare zitto', async () => {
    signOutMock.mockResolvedValue({ error: new Error('boom') })
    const { result } = renderHook(() => useSignOut())
    await act(() => result.current.signOut())
    expect(result.current.error).toBe('Non siamo riusciti a uscire. Riprova.')
  })
})
```

- [ ] **Step 5: Run it and watch it fail**

Run: `npx vitest run src/features/auth/hooks/useSignOut`
Expected: FAIL — cannot resolve `./useSignOut`.

- [ ] **Step 6: Write the hook**

```ts
import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { accountMessage } from '../utils/accountMessages'

/**
 * There was no way out of the app before this. On a phone left on the bench at
 * a pitch, a session nobody can end is the whole account.
 *
 * `AuthProvider` listens to `onAuthStateChange`, so the screen follows the
 * signed-out state on its own — there is nothing to navigate and nothing to
 * invalidate here.
 */
export function useSignOut() {
  const [leaving, setLeaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signOut() {
    setLeaving(true)
    setError(null)
    const { error } = await supabase.auth.signOut()
    if (error) setError(accountMessage(error, 'signout'))
    setLeaving(false)
  }

  return { signOut, leaving, error }
}
```

- [ ] **Step 7: Run both suites and the typecheck**

Run: `npx vitest run src/features/auth && npx tsc -b`
Expected: green, exit 0.

- [ ] **Step 8: Commit**

```bash
git add src/features/auth/utils/accountMessages.* src/features/auth/hooks/useSignOut.*
git commit -m "feat(auth): a way out of the app, and Italian for what can fail"
```

---

## Task 3: `useUpdateEmail`

**Files:**
- Create: `src/features/auth/hooks/useUpdateEmail.ts`
- Test: `src/features/auth/hooks/useUpdateEmail.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function useUpdateEmail(): {
    setEmail: (email: string) => Promise<void>
    saving: boolean
    error: string | null
    sent: boolean
  }
  ```
  `sent` is true once Supabase has accepted the change and dispatched the confirmation — **not** once the address is active. Spec §3.2: the address is pending until the customer clicks the link, and the screen must not claim otherwise.

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/hooks/useUpdateEmail.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { updateUserMock } = vi.hoisted(() => ({ updateUserMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { updateUser: updateUserMock } },
}))

import { useUpdateEmail } from './useUpdateEmail'

describe('useUpdateEmail', () => {
  beforeEach(() => updateUserMock.mockReset())

  it('manda la richiesta con l’indirizzo ripulito', async () => {
    updateUserMock.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('  Rossi@Example.com '))
    expect(updateUserMock).toHaveBeenCalledWith({ email: 'rossi@example.com' })
    expect(result.current.sent).toBe(true)
  })

  it('«sent» dice che la mail è partita, non che l’indirizzo è attivo', async () => {
    updateUserMock.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('rossi@example.com'))
    // Nessuna asserzione sulla sessione: l'indirizzo diventa attivo solo dopo
    // il clic sul collegamento, e questo gancio non lo sa e non lo finge.
    expect(result.current.sent).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('un indirizzo già di un altro account lo dice in italiano', async () => {
    updateUserMock.mockResolvedValue({ data: null, error: { code: 'email_exists' } })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('rossi@example.com'))
    expect(result.current.error)
      .toBe('Questo indirizzo è già collegato a un altro account. Entra con quello, oppure usane uno diverso.')
    expect(result.current.sent).toBe(false)
  })

  it('un secondo tentativo azzera l’esito del primo', async () => {
    updateUserMock.mockResolvedValue({ data: null, error: { code: 'email_exists' } })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('rossi@example.com'))
    expect(result.current.error).not.toBeNull()

    updateUserMock.mockResolvedValue({ data: {}, error: null })
    await act(() => result.current.setEmail('altro@example.com'))
    expect(result.current.error).toBeNull()
    expect(result.current.sent).toBe(true)
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/auth/hooks/useUpdateEmail`
Expected: FAIL — cannot resolve `./useUpdateEmail`.

- [ ] **Step 3: Write the hook**

```ts
import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { accountMessage } from '../utils/accountMessages'

/**
 * `updateUser({ email })` does not change the account's address. It records a
 * pending change and sends a confirmation link; until the customer clicks it,
 * the account still carries the old address, or none at all.
 *
 * So `sent` means "the message has gone out", never "the address works". The
 * screen has to say the same thing — an address shown as active that receives
 * nothing is the product claiming something it is not doing (spec §3.2).
 */
export function useUpdateEmail() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  async function setEmail(email: string) {
    setSaving(true)
    setError(null)
    setSent(false)
    const { error } = await supabase.auth.updateUser({
      email: email.trim().toLowerCase(),
    })
    if (error) setError(accountMessage(error, 'email'))
    else setSent(true)
    setSaving(false)
  }

  return { setEmail, saving, error, sent }
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run src/features/auth/hooks/useUpdateEmail && npx tsc -b`
Expected: 4 passed, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/hooks/useUpdateEmail.*
git commit -m "feat(auth): add an address, and say it is pending rather than active"
```

---

## Task 4: `useLinkGoogle`

**Files:**
- Create: `src/features/auth/hooks/useLinkGoogle.ts`
- Test: `src/features/auth/hooks/useLinkGoogle.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function useLinkGoogle(): {
    linkGoogle: () => Promise<void>
    linking: boolean
    error: string | null
  }
  ```

Manual identity linking is a Supabase **beta** feature and must be enabled in the project's auth configuration. When it is not, the call fails — and the screen must degrade to saying so rather than breaking (spec §5). Read `LoginPage.tsx`'s `signInWithGoogle` first: it already builds the `redirectTo` this project uses, and the linking call should agree with it rather than invent a second convention.

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/hooks/useLinkGoogle.test.ts`:

```ts
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { linkIdentityMock } = vi.hoisted(() => ({ linkIdentityMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { linkIdentity: linkIdentityMock } },
}))

import { useLinkGoogle } from './useLinkGoogle'

describe('useLinkGoogle', () => {
  beforeEach(() => linkIdentityMock.mockReset())

  it('chiede a Supabase di collegare Google', async () => {
    linkIdentityMock.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useLinkGoogle())
    await act(() => result.current.linkGoogle())
    expect(linkIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }))
    expect(result.current.error).toBeNull()
  })

  it('se il collegamento non è disponibile lo dice, invece di rompersi', async () => {
    linkIdentityMock.mockResolvedValue({
      data: null, error: { message: 'Manual linking is disabled' },
    })
    const { result } = renderHook(() => useLinkGoogle())
    await act(() => result.current.linkGoogle())
    expect(result.current.error).toBe('Non siamo riusciti a collegare Google. Riprova.')
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/auth/hooks/useLinkGoogle`
Expected: FAIL — cannot resolve `./useLinkGoogle`.

- [ ] **Step 3: Write the hook**

Mirror `LoginPage.tsx`'s `signInWithGoogle` for the redirect target — read it and use the same value rather than a second convention.

```ts
import { useState } from 'react'
import { supabase } from '@/shared/lib/supabase'
import { accountMessage } from '../utils/accountMessages'

/**
 * Attaches a Google identity to the account the customer already has, so that
 * signing in with either door lands on the same person.
 *
 * Supabase links identities by itself when the verified emails match; this is
 * for the case it cannot cover — an account created with the SMS code, which
 * has no email to match on.
 *
 * Manual linking is a beta feature and is off until it is enabled in the
 * project's auth configuration. When it is off this call fails, and the screen
 * says so: a button that silently does nothing is worse than one that explains.
 */
export function useLinkGoogle() {
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function linkGoogle() {
    setLinking(true)
    setError(null)
    const { error } = await supabase.auth.linkIdentity({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/profilo` },
    })
    if (error) setError(accountMessage(error, 'google'))
    setLinking(false)
  }

  return { linkGoogle, linking, error }
}
```

- [ ] **Step 4: Run the tests and the typecheck**

Run: `npx vitest run src/features/auth/hooks/useLinkGoogle && npx tsc -b`
Expected: 2 passed, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/hooks/useLinkGoogle.*
git commit -m "feat(auth): attach Google to an account that signed in by phone"
```

---

## Task 5: `ProfilePage`

**Files:**
- Create: `src/features/auth/components/ProfilePage.tsx`
- Test: `src/features/auth/components/ProfilePage.test.tsx`

**Interfaces:**
- Consumes: `useAuth` (`src/features/auth/hooks/AuthProvider.tsx`, returns `{ session, isAdmin, loading }`), and the three hooks from Tasks 2–4.
- Produces: `export function ProfilePage(): JSX.Element`.

Read `src/features/booking/components/MyBookingsPage.tsx` first for the page shell idiom — it wraps its content in `MobileFrame` with a title, and this screen should look like a sibling of it rather than a new kind of page.

What the screen shows, per spec §1, §3.1 and §3.2:

- **Signed out:** what the screen is for, and the way in. Not a redirect, not a locked door.
- **Signed in:** the phone the account carries, the address (active, or pending confirmation, or absent with a field to add one), a Google button when no Google identity is attached, and «Esci».

The pending address comes from `session.user.new_email`; the active one from `session.user.email`. Attached identities are in `session.user.identities` — a `provider` of `'google'` means it is already linked.

- [ ] **Step 1: Write the failing test**

Create `src/features/auth/components/ProfilePage.test.tsx`. Component tests in this repo stub hook modules with `vi.spyOn` on the namespace — see `src/features/admin/components/NewClosureDialog.test.tsx`.

```tsx
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'
import * as authProvider from '../hooks/AuthProvider'
import * as signOutHook from '../hooks/useSignOut'
import * as emailHook from '../hooks/useUpdateEmail'
import * as googleHook from '../hooks/useLinkGoogle'

function stubHooks() {
  vi.spyOn(signOutHook, 'useSignOut').mockReturnValue({
    signOut: vi.fn(), leaving: false, error: null,
  })
  vi.spyOn(emailHook, 'useUpdateEmail').mockReturnValue({
    setEmail: vi.fn(), saving: false, error: null, sent: false,
  })
  vi.spyOn(googleHook, 'useLinkGoogle').mockReturnValue({
    linkGoogle: vi.fn(), linking: false, error: null,
  })
}

function stubSession(user: Record<string, unknown> | null) {
  vi.spyOn(authProvider, 'useAuth').mockReturnValue({
    session: user ? ({ user } as never) : null,
    isAdmin: false,
    loading: false,
  })
}

function renderPage() {
  return render(<MemoryRouter><ProfilePage /></MemoryRouter>)
}

describe('ProfilePage', () => {
  beforeEach(() => { vi.restoreAllMocks(); stubHooks() })

  it('chi non è entrato viene invitato, non respinto', () => {
    stubSession(null)
    renderPage()
    expect(screen.getByRole('link', { name: /accedi/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Esci' })).not.toBeInTheDocument()
  })

  it('mostra il numero con cui si entra', () => {
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()
    expect(screen.getByText(/3331112233/)).toBeInTheDocument()
  })

  it('un indirizzo in attesa è detto in attesa, non come se funzionasse', () => {
    stubSession({
      phone: '393331112233', email: null,
      new_email: 'rossi@example.com', identities: [],
    })
    renderPage()
    expect(screen.getByText(/in attesa di conferma/i)).toBeInTheDocument()
    expect(screen.getByText(/rossi@example.com/)).toBeInTheDocument()
  })

  it('un indirizzo confermato è mostrato senza avvisi', () => {
    stubSession({
      phone: '393331112233', email: 'rossi@example.com', identities: [],
    })
    renderPage()
    expect(screen.getByText(/rossi@example.com/)).toBeInTheDocument()
    expect(screen.queryByText(/in attesa di conferma/i)).not.toBeInTheDocument()
  })

  it('offre di collegare Google solo se non è già collegato', () => {
    stubSession({ phone: '393331112233', email: null, identities: [] })
    const { unmount } = renderPage()
    expect(screen.getByRole('button', { name: /collega google/i })).toBeInTheDocument()
    unmount()

    stubSession({
      phone: '393331112233', email: 'rossi@example.com',
      identities: [{ provider: 'google' }],
    })
    renderPage()
    expect(screen.queryByRole('button', { name: /collega google/i })).not.toBeInTheDocument()
  })

  it('l’uscita chiama signOut', async () => {
    const signOut = vi.fn()
    vi.spyOn(signOutHook, 'useSignOut').mockReturnValue({ signOut, leaving: false, error: null })
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()
    screen.getByRole('button', { name: 'Esci' }).click()
    expect(signOut).toHaveBeenCalled()
  })

  it('dice se il salvataggio dell’indirizzo non è riuscito', () => {
    vi.spyOn(emailHook, 'useUpdateEmail').mockReturnValue({
      setEmail: vi.fn(), saving: false, sent: false,
      error: 'Questo indirizzo è già collegato a un altro account. Entra con quello, oppure usane uno diverso.',
    })
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()
    expect(screen.getByText(/già collegato a un altro account/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/features/auth/components/ProfilePage`
Expected: FAIL — cannot resolve `./ProfilePage`.

- [ ] **Step 3: Write the screen**

Build it from the pieces the repo already has: `MobileFrame` for the shell, `.field` for the input, `ErrorNote` for failures, `pointer-coarse:min-h-11` on anything meant for a thumb, and `LOGIN_ROUTE` from `@/shared/lib/routes` for the way in. Keep the copy Italian and the comments English.

The shape, with the parts that carry a decision:

```tsx
const user = session?.user
const pending = user?.new_email as string | undefined
const hasGoogle = (user?.identities ?? []).some((i) => i.provider === 'google')
```

- When `session` is null: a sentence saying what the screen holds and a `Link` to `LOGIN_ROUTE` whose accessible name contains «Accedi».
- The phone: `user.phone` is stored in E.164 without the `+` (`393331112233`).
  **There is no display formatter in this repo** — checked. The only phone
  helper is `toE164`, which goes the other way and is exported from
  `LoginPage.tsx`, a component. Do not import a formatting helper out of a
  component: either show the number as it is, or put a small pure function in
  `src/features/auth/utils/` beside `accountMessages.ts` and test it. Say which
  you chose and why in your report.
- The address block, in priority order: **pending** («In attesa di conferma: …», plus what to do), then **active**, then **absent** with the field and a «Salva» button.
- After a successful send (`sent`), say the message has gone and the address is not active yet — never that it is saved.
- «Collega Google» only when `!hasGoogle`.
- «Esci» at the bottom, with `useSignOut`'s error beneath it.

- [ ] **Step 4: Run the tests and every gate**

Run: `npx vitest run src/features/auth && npx tsc -b && npm run lint`
Expected: green, exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/auth/components/ProfilePage.*
git commit -m "feat(auth): the account screen the app was missing"
```

---

## Task 6: the route, the fourth tab, and the manual step

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/shared/components/ui/MobileTabBar.tsx`
- Test: `src/shared/components/ui/MobileTabBar.test.tsx` (existing — extend)
- Modify: `docs/come-provare.md`

**Interfaces:**
- Consumes: `ProfilePage` from Task 5.
- Produces: nothing new.

- [ ] **Step 1: Write the failing tab test**

Read `src/shared/components/ui/MobileTabBar.test.tsx` first and extend it in its own idiom. Two cases:

- the bar renders a «Profilo» tab pointing at `/profilo`;
- `matchesTab('/profilo', '/profilo')` is true, and `matchesTab('/prenota', '/profilo')` is false — the existing helper already guards against a bare `startsWith`, and a fourth route is a fourth chance to break it.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run src/shared/components/ui/MobileTabBar`
Expected: FAIL — no «Profilo» tab.

- [ ] **Step 3: Add the tab and the route**

In `MobileTabBar.tsx`, append a fourth entry to `TABS` with `to: '/profilo'`, `label: 'Profilo'`, and an icon drawn in the same stroke idiom as its three siblings (they are single `<path>`/`<rect>` children of one `<svg>`; match it).

In `App.tsx`, add `<Route path="/profilo" element={<ProfilePage />} />` beside the other customer routes. `ProfilePage` is **not** wrapped in `RequireAdmin` and must not be wrapped in any auth guard — the screen handles the signed-out case itself (spec §3.1).

- [ ] **Step 4: Check the bar still fits four tabs at phone width**

The bar was laid out for three. Read its container classes and confirm a fourth does not overflow or shrink the labels below legibility at 360px. If it does, fix the layout in this task and say what you changed — do not leave it for the walkthrough to discover.

Run: `npx vitest run src/shared/components/ui/MobileTabBar && npm run build`

- [ ] **Step 5: Add the manual step**

In `docs/come-provare.md`, add a scenario for the part no automated test can prove: add an address from the profile, receive the confirmation mail, click the link, and come back to see the address active rather than pending. Note that it requires manual linking to be enabled in the Supabase project for the Google half, and say where that setting lives.

- [ ] **Step 6: Run every gate**

Run:
```bash
npm run test
npx tsc -b && npm run lint && npm run build
npm run db:reset && npm run test:db
```
Expected: all green. `BookPage.test.tsx` and `DayStrip.test.tsx` must pass **untouched** and stay out of the diff; if either must change, stop and report rather than editing them.

- [ ] **Step 7: Commit**

```bash
git add -A src docs/come-provare.md
git commit -m "feat(app): a profile tab, and the route behind it"
```

---

## Self-review notes

Checked against the spec, section by section:

- §2.1 (phone stays the key, no email-password door) → nothing in this plan adds a sign-in method; Task 4 attaches an identity to an existing account.
- §2.2 (automatic linking free; manual linking beta) → Task 4, including the degrade-and-say-so path.
- §2.3 (an address is asked for when it buys something) → **partially deferred by design**: this plan builds the profile screen where it can be added and changed. The prompt at the moment it pays off belongs with the reminders that pay it off, and is named in the next sub-project rather than built here with nothing to promise.
- §2.4 (`members.email` follows the account) → Task 1, with the null-guard so an empty account cannot erase a card's address.
- §2.5 (no reminder toggle) → absent from every task, deliberately.
- §2.6 (signing out exists) → Task 2.
- §3.1 (a signed-out visitor is invited) → Task 5's first test, and Task 6's instruction not to guard the route.
- §3.2 (pending is not active) → Task 3's `sent` semantics and Task 5's pending test.
- §3.3 (an address already taken) → Task 2's message and Task 5's error test.
- §6 (verification) → pgTAP in Task 1, Vitest in Tasks 2–6, the manual round-trip in Task 6.

One deviation from the spec's file table, stated: it listed `useSignOut.ts` and `accountMessages.ts` as separate rows, and this plan builds them in one task. They are two small files with one consumer each and no independent review surface — splitting them would buy a review of four lines.

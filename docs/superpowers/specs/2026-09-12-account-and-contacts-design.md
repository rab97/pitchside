# The customer's account, and how to reach them — design spec

A screen where a customer can see how they sign in, add an email, attach
Google, and sign out — the last of which the app cannot do at all today.

Raised while scoping reminder notifications: a notification needs somewhere to
send it, and almost no customer has an address. This sub-project is what makes
the next one able to deliver anything.

> Written in English per the convention adopted on 11 September 2026. Every
> string a user reads stays Italian.

---

## 1. What we are building

A fourth tab in the customer app — the profile — holding four things: who you
are, how you sign in, your contact details, and the way out.

The reason it exists now is reachability. Three routes create a customer, and
only one of them yields an email address:

| How the customer comes into being | Email? |
|---|---|
| The manager creates them during a phone call | **no** — name and phone, nothing else |
| They sign in with the SMS code | **no** — `auth.users.email` stays empty |
| They sign in with Google | yes |

So today an email reminder would reach the third group and nobody else, while a
phone number — made mandatory on 12 September — reaches everyone. The free
channel is the one that cannot arrive and the paid one is the only one that can,
which is the reverse of how "email first, SMS later" is usually reasoned.

This spec does not fix that inversion. It gives the customers who do use the app
a way to hand over an address, and it gives the app the account screen it is
missing.

---

## 2. The decisions that hold this up

### 2.1 The phone stays the key. There is no email-and-password door.

This was reconsidered deliberately and deliberately kept.

The project's founding spec (§2.1) makes the phone the identity: it is the only
datum the manager has of every customer, and `ensure_my_member` uses a
**verified** number to adopt the card the manager created during years of phone
calls. Adoption is not sentiment about history — it is what stops a returning
customer's first sign-in from colliding with the unique index on
`(facility_id, phone_key(phone))`. Without it, the people the facility has most
of would simply fail to sign in.

Adding email-and-password as a third door would introduce a **second key**, and
a second key is the generator of a duplicate that **cannot be undone**: Supabase
cannot merge two existing accounts. Every other mistake in this area is
recoverable; this one is not.

What well-run apps actually do, behind three buttons, is key everything on one
identifier and attach the rest to it. Phone-centred products — messaging, ride
hailing, banking — key on the number and treat email as a contact, not a door.
That is the shape adopted here.

### 2.2 Automatic linking is free; the work is preventing the second account

Supabase already links identities that share a **verified** email: someone who
has an account and then signs in with Google lands on the same user, with no
code from us. That half needs enabling, not building.

Phone and email are different identifiers, so they are never linked
automatically. The bridge is `updateUser` — adding an email to a phone account,
or a phone to an email account — which is the same gesture the customer makes to
become reachable. **The contact screen is the bridge**, not an extra.

Manual linking of an OAuth identity (`linkIdentity`) is a beta feature and must
be switched on in the project's auth configuration.

### 2.3 An address is asked for when it buys something

Not at registration. A long sign-up form loses people; a request that says what
it gets you does not. The email is asked for where it pays off — when the
customer wants to be told about their bookings — and the profile screen is where
it can be changed afterwards.

### 2.4 `members.email` follows the account's verified email

`ensure_my_member` copies the email **once**, when it creates the card. A
customer who adds an address later keeps an empty card, and the notification
system would look in the wrong place and find nothing.

`ensure_my_member` refreshes it instead: it already runs whenever the customer
uses the app, so the value catches up on their next visit. A trigger on
`auth.users` would be instant but reaches into the auth schema, which this
project has never done and should not start doing for a field that can be a few
minutes stale.

The cost is stated rather than hidden: the sync is lazy. A customer who confirms
an address and never opens the app again has it on their account and not on
their card.

It is also **single-facility**, which is the sharper half of the same cost. The
refresh is scoped by `p_facility`, so it updates only the card belonging to the
app the customer is using, while its sibling `claim_members_by_verified_phone`
deliberately works across every facility — the two disagree about scope on
purpose, and this is where that is written down. In a product whose first rule
is multi-structure, the consequence is easy to reach: a customer of two
facilities confirms an address in the first one's app and goes on booking at the
second by telephone, as always, so he never opens its app. The second
facility's card holds `NULL` for good.

Widening the refresh to `m.user_id = auth.uid()` is the obvious fix and is
deliberately not done here. It needs an index on `user_id` first —
`members_facility_user_uniq` is `(facility_id, user_id)` and cannot serve a
lookup on `user_id` alone — and the moment to weigh that index is when the
reminder job exists and we know whether it reads the card at all or goes to
`auth.users` directly, which would retire the question. **So this is a decision
the reminders sub-project has to take, not a defect to carry:** it must either
widen the refresh, or read addresses from a place that is not per-facility.

And a rule fixed here while it is cheap, because two writers for one column
arrive the day the manager's screen gains an email field: **the account's
confirmed address wins over one typed by the manager.** Only the confirmed one
is evidence that somebody reads that mailbox, and only it can be corrected by
the person it belongs to. A manager's entry holds until the customer confirms
an address, and is replaced on the next visit afterwards — so that screen will
have to say as much where the field is, rather than let an entry vanish
silently.

### 2.5 No reminder toggle in this sub-project

The customer will choose whether to be told, and that switch belongs on this
screen. It is not built here, because here it would send nothing.

A control that promises something the product does not do is worse than a
missing one: the customer turns it on, believes they will be reminded, and is
not. The switch ships with the thing it switches.

### 2.6 Signing out exists

`signOut` appears nowhere in `src/`. A customer who signs in cannot sign out —
on a shared phone at a pitch, that is the whole account.

It is not related to notifications, and it is in scope anyway: this is the
screen it belongs on, and building the screen without it would mean coming back.

---

## 3. What gets built

| File | Responsibility |
|---|---|
| `src/features/auth/components/ProfilePage.tsx` | the screen: identity, contacts, linking, sign out |
| `src/features/auth/hooks/useUpdateEmail.ts` | add or change the address, and its pending-confirmation state |
| `src/features/auth/hooks/useLinkGoogle.ts` | attach a Google identity to the current account |
| `src/features/auth/hooks/useSignOut.ts` | the way out |
| `src/features/auth/utils/accountMessages.ts` | SQLSTATE and auth errors → Italian sentences |
| `src/shared/components/ui/MobileTabBar.tsx` | modified: a fourth tab |
| `src/App.tsx` | modified: the `/profilo` route |
| `supabase/migrations/0023_member_email_refresh.sql` | `ensure_my_member` refreshes `members.email` |

### 3.1 A signed-out visitor is invited in, not refused

The tab is always there. Someone who has not signed in sees what the screen is
for and the way to sign in, rather than a locked door or a redirect — the app
already treats signing in as something you do when you need it, and a fourth tab
that throws you out on tap would be the only place that does otherwise.

### 3.2 A changed address is not an address until it is confirmed

`updateUser({ email })` does not change the account's email — it records a
pending change and sends a confirmation link. Until the customer clicks it, the
account still carries the old address, or none.

The screen must say so. An address shown as though it were active, which
receives nothing because nobody clicked the link, is the same failure as §2.5:
the product claiming something it is not doing.

### 3.3 An address already on another account

Emails are unique across accounts, so Supabase refuses. The refusal arrives as
an auth error and must become an Italian sentence that says what happened and
what to do — not a passed-through message, and not a silent failure.

---

## 4. Out of scope

- **Email-and-password sign-in.** §2.1.
- **Merging two accounts that already exist.** Supabase cannot, and neither will
  we. Prevention is the whole strategy.
- **The reminders themselves**, and the switch that turns them on. §2.5.
- **The manager collecting an email** when creating a customer during a call. A
  customer who only ever phones therefore stays unreachable by email, by
  construction — that is the argument for SMS, not a gap to patch here.
- **Apple sign-in.** Named in the founding spec as a future shortcut; nothing
  here forecloses it.

---

## 5. Risks

| Risk | Why it is worrying | Mitigation |
|---|---|---|
| A customer attaches Google to the wrong account | irreversible: identities can be unlinked, accounts cannot be merged | the screen names which account is being attached to, before the gesture, not after |
| Manual linking is a beta feature | it can change under us, and it needs a project setting that is not in this repository | the setting is recorded in the manual test guide; the screen degrades to "not available" rather than breaking if the call is refused |
| The lazy `members.email` refresh | an address that exists on the account and not on the card reaches nobody | §2.4 states it; the next sub-project reads the card and must treat a missing address as "cannot reach", never as "no preference" |
| A fourth tab on a three-tab bar | the bar is sized and spaced for three | the tab bar's own tests cover its layout; the phone walkthrough gains a step |
| Touching `ensure_my_member` | it carries the adoption every returning customer depends on | its existing pgTAP coverage is the guard, and the refresh is additive — no existing branch changes |
| Nothing configures outbound email, and the committed send limit is 2/hour | there is no `[auth.email.smtp]` block anywhere, and `email_sent = 2` under `[auth.rate_limit]`. With `double_confirm_changes = true` a single address *change* sends two messages, so it consumes the whole hour: the next customer to add an address gets a 429, which the screen renders as «Non siamo riusciti a salvare l'indirizzo. **Riprova**» — an instruction that cannot succeed until the hour turns | this repository has neither the credentials nor the authority to choose a provider, so it is recorded instead of fixed: **a real SMTP provider and a realistic `email_sent` are preconditions of the reminders sub-project**, not polish afterwards. Also written at `docs/come-provare.md` §13, where whoever runs the manual pass will meet it |
| The confirmation link lands on `site_url`, not on the screen that asked | Supabase builds it from `site_url` — `http://127.0.0.1:3000` locally, the dev server being on 5174 — so the customer confirms and arrives somewhere else entirely. Locally that is a connection refused *after* the confirmation has already succeeded, which reads as a failure and is not one | `ProfilePage` calls `ensure_my_member` (§2.4), so the card catches up whenever the customer comes back to the profile; `docs/come-provare.md` §13 warns the tester before they file the defect that did not happen |

---

## 6. Verification

- **pgTAP** for the refresh: a card whose email is empty gains the account's
  address on the next call; a card that already matches is not written again;
  and **every existing adoption assertion passes unchanged** — that function is
  load-bearing and this spec only adds to it.
- **Vitest** for the screen: a pending address is shown as pending and not as
  active; an address already taken produces the Italian sentence rather than the
  provider's; sign out calls `signOut`; the Google button is absent when the
  identity is already attached.
- **By hand, on a phone**, added to `docs/come-provare.md`: add an address,
  confirm it from the mail, and come back to see it active — the confirmation
  round-trip is the part no automated test here can prove.

---

## References

- Project spec: `docs/superpowers/specs/2026-09-05-prenota-campi-design.md`
  (§2.1 the phone is the identity, §2.2 customer and user are the same table)
- `supabase/migrations/0012_member_identity.sql`, `0016_member_adoption.sql`
- Supabase — Identity Linking:
  https://supabase.com/docs/guides/auth/auth-identity-linking

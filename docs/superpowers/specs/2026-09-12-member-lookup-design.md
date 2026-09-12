# Recognising the caller — design spec

The manager answers the phone. Before anything else they need to know who is
speaking: whether this person is already a customer, whether they turn up,
what was written about them last time, and what they usually book.

Today the booking dialog guesses at that and never says so. This spec replaces
the guess with a search, and gives the manager a card to read while they talk.

> Written in English per the convention adopted on 11 September 2026. Every
> string a user reads stays Italian.

---

## 1. What we are building

Inside «Nuova prenotazione», the name field becomes a real search over the
facility's members. Choosing a result shows that person's card in place:
reliability in plain counts, price list, what they usually book and when they
last played, and the internal notes — the only field that can be written here.

This is not a customer registry. There is no `/admin/clienti` page, no listing,
no merge tool. The job is narrower and more urgent than any of those: **the
manager is on a call and needs to recognise who is on the other end**. A page
they would have to navigate to does not serve that, because leaving the day
grid mid-call is the thing they will not do.

A registry may follow. Nothing here forecloses it — the two functions this
spec adds are exactly what such a page would query.

---

## 2. The decisions that hold this up

### 2.1 The dialog stops guessing

`NewBookingDialog.ensureMember` searches for a candidate by phone or name and,
if it finds one, silently reuses it; otherwise it inserts a new row. All of it
at submit time, none of it visible.

When the guess is right nobody notices. When it is wrong a booking has been
attached to the wrong person, and no screen in the product shows it.

The heuristic goes away, along with `pickExistingMember`. Two deliberate
gestures replace it: **choose this customer**, or **this one is new**.

Creating a customer must cost one more click than choosing an existing one. It
is the only moment duplicates are born, and making it visible is half of
preventing them.

### 2.2 Ranking is domain logic, so it lives in Postgres

If the right customer is not the first row, the manager picks the wrong person
while someone is talking to them. That ordering is the feature. It belongs in
SQL where pgTAP can pin it, not in a filter string assembled in the browser.

Today's search builds `or(name.ilike."…",phone.eq."…")` by hand, with a helper
that adds quotes and a comment explaining that a name containing a comma would
break the filter's syntax. That is search logic living inside a string. The
moment it must ignore accents or rank its results, the string is the wrong home.

Two functions, deliberately split by how often they run:

- `search_members(p_facility, p_query)` — fires on every keystroke, returns a
  few light columns, ranked.
- `member_card(p_member_id)` — fires once per call, and can afford aggregates.

Computing booking history for every candidate on every keystroke, for rows the
manager will never open, is the cost the split exists to avoid.

### 2.3 One field, two meanings, inferred from what was typed

The manager does not choose "search by name" or "search by phone". They type.
Text containing at least three digits is also matched against `phone_key`;
otherwise it is matched as a name only. A toggle would be one more decision
while another person is speaking.

`phone_key` keeps the last ten digits of a number, so the digits typed are
matched as a **prefix of that key**, and as an exact match once ten of them are
in. Typing the first digits of a number narrows; typing the whole number lands
on one row. Matching a fragment from the middle is deliberately not supported:
it would turn every keystroke into a scan for a case the manager reading a
caller ID does not have.

Accents are ignored — a manager typing fast writes «Nicolo», not «Nicolò». This
needs the `unaccent` extension, enabled in a migration.

### 2.4 The ranking

1. exact phone
2. phone starts with
3. name starts with
4. name contains

Ties break by **most recent booking first**: whoever is calling is more likely
to be a regular than someone who vanished two years ago.

Eight results, from two characters up. Eight can be scanned by eye without
scrolling; below two characters half the address book matches.

A row shows the name and the phone, and nothing else — except a discreet mark
when that customer has at least one missed booking. **The list is for
recognising, the card is for judging.** Putting percentages in the list makes
the manager choose for the wrong reason.

### 2.5 Reliability is told in counts, because the percentage lies

`honored_count` is declared on `members`, read by `member_reliability`, and
**incremented by nothing**. Searched across the whole project: only test
fixtures ever set it. `missed_count` is incremented in four places and works.

So today the percentage can hold exactly two values: `null` when there are no
misses, and **`0%`** as soon as there is one. A customer who has played fifty
times and missed once reads 0%. Shown on a card, that number would make the
manager treat their best customers worst.

The truth exists, elsewhere. A booking that is `active` and whose slot has
passed is an appearance — nobody marked it `no_show`. It is derivable now, with
no new writes and no backfill.

Two consequences:

- **The card shows counts and words, never a percentage.** «Si è presentato 23
  volte, 2 mancate». A percentage invites comparing people and hides how many
  cases it rests on: 0% over one booking and 0% over fifty are the same figure
  and opposite situations. With no history it reads «cliente nuovo» — which is
  information, not an absence.
- **Appearances are counted from `bookings`, not from the counter.**

This leaves `honored_count` as dead weight. Wiring it up needs something that
says "the match happened", which is real work and a sub-project of its own.
Deciding that is explicitly **not** part of this one, and the card does not
depend on it.

### 2.6 A phone number is optional, and the cost is stated

A caller may refuse to give a number and the booking must still happen;
refusing it would be absurd. But a member with no phone is the row that cannot
be recognised next time, and that is where duplicates come from.

So the dialog says so, in one line, at the moment of deciding — not as a
warning to dismiss, as a statement of fact.

### 2.7 A number already on another name is a question, not an error

If the manager creates a customer with a number that already exists under a
different name, it is almost always the same person written twice, or someone
whose card carries an old name.

There is no "go on anyway" here, and the dialog must not offer one: the unique
index on `phone_key` refuses a second row with that number, so an option to
proceed would be a button that always fails. The two real choices are **use
that card** — the common case, and the one that stops a duplicate — or **remove
the number** and create the customer without it, accepting §2.6's cost.

Saying this in Italian, before the write, is better than letting a database
error arrive after it.

Two managers creating the same number at the same moment land in the same
place: the unique violation becomes «qualcuno l'ha appena creato, eccolo», and
the search re-runs.

### 2.8 A failed search never blocks a booking

The phone is ringing. If `search_members` fails, the field falls back to plain
text and says the customer was not recognised. A dialog that refuses to work
because an accessory table could not be queried is worse than no search at all.

---

## 3. What gets built

| File | Responsibility |
|---|---|
| `supabase/migrations/0020_member_lookup.sql` | `unaccent`; `search_members`; `member_card` |
| `src/features/admin/hooks/useMemberSearch.ts` | the keystroke query |
| `src/features/admin/hooks/useMemberCard.ts` | the card, fetched once per selection |
| `src/features/admin/hooks/useUpdateMemberNotes.ts` | the one write |
| `src/features/admin/components/MemberSearchField.tsx` | the field, its results, the "new customer" gesture |
| `src/features/admin/components/MemberCard.tsx` | what the manager reads while talking |
| `src/features/admin/components/NewBookingDialog.tsx` | modified: `ensureMember` and `pickExistingMember` are deleted |

Both functions are `stable` and rely on the existing RLS on `members`: a
manager reads their own facility and no other. They are not `security definer` —
there is nothing here a facility admin may not already read, and a definer
function would have to re-implement the tenant check that RLS already enforces.

`member_card` returns `notes`, which are internal and never shown to a
customer. The dialog is behind `RequireAdmin`; the function is reachable only
by someone `is_facility_admin` already admits.

### 3.1 Notes save on blur

Free text, saved when the field loses focus, not behind a button. On a call
people type in a hurry, and a note lost because nobody clicked is worse than a
note saved half-written.

They save **even if the booking is then abandoned**: the note is about the
person, not the appointment.

The write follows the rule every mutation on this project follows — it asks for
the affected row back, because a write excluded by an RLS `using` clause
matches zero rows and returns no error.

---

## 4. Out of scope

- **A customer registry page.** No listing, no merge, no bulk edit. §1.
- **Editing anything but notes** from this card — not the name, phone, email or
  price list. Those belong to the registry, when there is one.
- **Making `honored_count` work.** §2.5.
- **Deduplicating what already exists.** This spec stops new duplicates from
  being created silently; it does not clean up the ones already there.
- **Search across facilities.** Every query stays inside one `facility_id`.

---

## 5. Risks

| Risk | Why it is worrying | Mitigation |
|---|---|---|
| The right customer is not the first row | the manager picks the wrong person mid-call, and the booking lands on someone else's name | the ranking is SQL and is pinned case by case in pgTAP, §2.4 |
| "name contains" cannot use an index | `members_name_idx` covers `lower(name)`, so it serves "starts with" only; a contains-match is a scan | at a few thousand members it is a few milliseconds; recorded here because it is the kind of thing that surprises someone in three years, not tomorrow |
| The search becomes a blocker | it sits in the middle of the one screen that must work while a phone rings | §2.8, and a test that books with the search failing |
| Notes are internal and this puts them on screen | a customer must never read them | the dialog is admin-only and the function is reachable only through `is_facility_admin` |
| Deleting `ensureMember` changes how members are created | the current behaviour is implicit and may be relied on elsewhere | it has exactly one caller; the replacement is explicit and tested |

---

## 6. Verification

- **pgTAP** for what decides the outcome: the ranking, case by case; accent
  insensitivity; the tenant rule — a manager of one facility finds nobody from
  another, not even by exact phone; `member_card`'s aggregates against a known
  fixture, including a member with no history at all.
- **Vitest** for the dialog: typing shows results; choosing one shows the card;
  notes save on blur; creating a customer takes a deliberate gesture; a number
  already held by someone else offers that card instead of failing; **and a
  booking completes with the search failing**.
- `NewBookingDialog` is at **zero coverage today** — 66 lines of 66 untested.
  This work closes that, as a consequence of testing what it changes rather
  than as a number being chased.

---

## References

- Project spec: `docs/superpowers/specs/2026-09-05-prenota-campi-design.md`
  (§4 Persone, §5.5 Affidabilità)
- Facility configuration: `docs/superpowers/specs/2026-09-11-facility-configuration-design.md`
- Panel UI primitives: `docs/superpowers/specs/2026-09-11-ui-primitives-design.md`
- `supabase/migrations/0004_members.sql`, `0012_member_identity.sql`,
  `0016_member_adoption.sql`

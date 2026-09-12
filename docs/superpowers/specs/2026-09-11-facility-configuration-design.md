# Phase 1B · Facility configuration — design spec

The manager's own tooling: pitches, price bands, closures, and the club's
settings, all editable from the panel instead of from `psql`.

This is the second of the three sub-projects phase 1B was split into. The first
one — the customer app — shipped on 11 September 2026. The third, notice board
and reminder notifications, is still untouched.

> Written in English per the convention adopted on 11 September 2026. The
> product's own copy — every string a customer or a manager reads on screen —
> stays in Italian, as `CLAUDE.md` requires.

---

## 1. What we are building

Today the database holds everything a club needs to be configured — `fields`,
`price_bands`, `closures`, and the booking rules on `facilities` — with admin
write policies already in place. What it does not have is a single screen for
any of it. Changing a price, closing for a holiday, or adding a fourth pitch
means opening a SQL client.

That is the last hard blocker to Palacalcetto running the product without us,
and it is the whole of this sub-project: four screens over tables that already
exist, plus two pieces of database work that the screens make necessary.

It is deliberately not a rewrite. No table is redesigned for the sake of the UI,
with one exception, argued in §2.2, where the UI exposed a rule the schema could
not express.

---

## 2. The decisions that hold this sub-project up

### 2.1 Price bands are the opening hours

`calc_booking_price` treats a minute not covered by any band as outside opening
hours and raises PS005. There is no separate notion of opening time anywhere in
the database, though the phase-1 spec lists one on `facilities`.

We keep it that way, and the panel is built around it rather than against it.
The alternative — explicit hours that the bands must cover exactly — is two
sources of truth that have to agree, kept honest by validation that would exist
only to reconcile them. One source cannot disagree with itself.

The cost is real and accepted: there is no way to say "open but free" except a
band priced at zero, which is arguably the honest way to say it. The duty this
places on the interface is that a gap must **read** as closed, never as blank.
That is why the prices screen is a week of timelines and not a table of rows:
deleting a band visibly shuts the pitch, instead of shutting it silently.

### 2.2 Overlapping bands are a money bug, and the database should say so

`calc_booking_price` selects the band covering a minute with `select … limit 1`
and no `order by`. Two overlapping bands therefore make the price charged depend
on which row Postgres happens to return. The phase-1 spec already forbids
overlaps — *"le fasce non si sovrappongono … la validazione avviene al
salvataggio"* — but nothing enforces it: no constraint, no trigger, and
validation "on save" never existed because there was no save to validate.

It has been harmless so far only because the seed has no overlaps. A
configuration panel is precisely the thing that starts creating them, so it
cannot ship without the rule being real.

Validation in the form is not enough. It would leave `psql`, any future import
script, and any later code path free to write an overlap, and the failure is
silent — nobody gets an error, a customer just gets charged the wrong price.

**`weekdays smallint[]` cannot carry that constraint.** An exclusion constraint
compares one row's values against another's with operators; there is no operator
class that says "these weekdays overlap those weekdays" for `smallint[]` without
adding `intarray` and changing the column type anyway.

So the row becomes one weekday:

```sql
exclude using gist (
  field_id with =,
  weekday  with =,
  int4range(starts_min, ends_min) with &&
)
```

`btree_gist` has been installed since migration 0001, for the bookings
constraint. Nothing new is needed.

The band stays a single idea in the interface — tick the weekdays, set the hours
and the price, save once — and becomes several rows underneath. That split is
the point: the form keeps the concept a manager has, the schema keeps the shape
a constraint can check.

### 2.3 The panel writes to tables; exactly one RPC is added

`fields`, `price_bands`, `closures` and `facilities` all carry
`*_write_admin` policies gated on `is_facility_admin`. Ordinary editing needs no
RPC: the database already refuses a manager of another club, and adding a
function in front of it would only move the same check somewhere less reliable.

One operation genuinely needs a function: creating a closure that cancels the
bookings it covers. It writes to `bookings`, which project rule keeps RPC-only,
and the closure and the cancellations must be one transaction or neither.

The conflict *preview* is not an RPC. A manager can already read their club's
bookings through RLS, so the list of what a closure would hit is a plain
`select`. Only the write needs privileges.

### 2.4 Closing is an event, not a form submission

A pitch closes because something happened — a burst pipe, a holiday, a
tournament. When bookings already exist inside that period, three behaviours
were possible: refuse until they are cancelled by hand, cancel them along with
the closure, or leave them alone.

Leaving them alone means a customer arrives at a locked gate holding a booking
the system still calls active — the panel hiding a contradiction it can see.
Refusing is safe but turns a holiday into a dozen manual cancellations, done
under time pressure.

So: the panel shows what the closure would hit — who, when, how much — asks for
confirmation, and on confirm does both together.

**A closure must not damage anyone's reliability.** `cancel_booking` increments
`missed_count` for a late cancellation, which is right when a player drops out
and wrong when the club shuts the pitch. The new function writes
`status = 'cancelled'` itself rather than calling `cancel_booking`, and touches
no counter.

Telling the customer is out of scope here — notifications are the third
sub-project. Until then the confirmation list doubles as a call list: it carries
names and phone numbers.

### 2.5 Feature flags wait for a feature to flag

`facilities.features` is a `jsonb` column that nothing reads — not one line of
the app, not one line of SQL. The phase-1 spec also requires flags to bite
server-side, not merely hide buttons.

A UI over it today would be a control wired to nothing, and a free-form JSON box
invites typos into a column no validation protects. The switch gets built
beside the first feature that actually needs switching off.

---

## 3. Architecture

Four routes behind the existing `RequireAdmin`, joined by one tab bar labelled
«Impostazioni», reached from a link in the day grid's toolbar:

```
/admin             the day grid            (unchanged)
/admin/campi       pitches
/admin/tariffe     price bands and hours
/admin/chiusure    closures
/admin/struttura   club details and booking rules
```

Each page is lazy-loaded on its own, the way `AdminPage` already is, so a
customer opening the home page never downloads any of the panel — and a manager
who only ever changes a price never downloads the closures screen either.

Code follows the structure `CLAUDE.md` lays down:

```
features/admin/
  components/   one screen per file, plus the tab bar
  hooks/        one query per file, name starts with use
  utils/        pure logic — the timeline builder above all
```

The screens are responsive down to phone width — they are forms and lists — but
they do not get the mobile tab-bar shell the customer pages have. The day grid
is a desktop instrument and `/admin` stays as it is.

---

## 4. Data model

Only one table changes.

| Table | Change |
|---|---|
| `price_bands` | `weekdays smallint[]` → `weekday smallint`, one row per day, plus the exclusion constraint of §2.2 |
| `fields` | none |
| `closures` | none |
| `facilities` | none |

The migration expands each existing row into one row per weekday — 9 rows become
36 in the current seed — and adjusts the two functions that read the column:

- `calc_booking_price` (migration 0005): `dow = any(pb.weekdays)` becomes
  `dow = pb.weekday`;
- `slot_prices` (migration 0014): the same substitution.

Both get simpler. No client code reads `price_bands` directly — the customer app
goes through `slot_prices` — so the change stops at the database plus regenerated
types.

### The new function

```
create_closure(p_facility_id, p_field_id, p_period, p_reason)
  → count of bookings cancelled
```

`p_field_id` null means the whole club, matching the nullable column. It
authorizes with `is_facility_admin(p_facility_id)` **before acting**, inserts the
closure, cancels the active bookings whose slot overlaps the period, and returns
how many. Authorizing rather than merely executing is the lesson phase 1B paid
for; migration 0011 and the pgTAP suite `007_rpc_authorization` are the
precedent this follows.

---

## 5. The screens

### 5.1 Pitches — `/admin/campi`

The list, reorderable, showing name, type, surface, covered, active.

One constraint decides the interaction: `bookings.field_id` is
`on delete restrict`, so **a pitch that has ever been booked can never be
deleted**. The panel offers *deactivate*, which `create_booking` already honours
by raising PS002, and shows *delete* only for a pitch with no bookings. When
deletion is refused it says why, in those words, instead of surfacing a foreign
key violation.

Deactivating a pitch that has future bookings is allowed, and warns: those
bookings stay valid, and closures are the tool for actually shutting a pitch
down. The cancel-along-with flow is deliberately not repeated here — a second
path doing the same job worse.

### 5.2 Price bands — `/admin/tariffe`

The centrepiece. Pick a pitch, see its week as seven timelines:

```
Campo 1
         00:00      09:00           19:00        24:00
lunedì   ░░░░░░░░░░░│███ 20,00 € ███│██ 25,00 € ██│
martedì  ░░░░░░░░░░░│███ 20,00 € ███│██ 25,00 € ██│
…
sabato   ░░░░░│██████ 22,00 € ████████████████████│
domenica ░░░░░░░░░░░░░░░░░ chiuso ░░░░░░░░░░░░░░░░│
```

A gap is closed and reads as closed. That is the entire argument of §2.1 made
visible, and the reason this screen is a timeline rather than a table.

Creating or editing a band is one form — weekdays, start, end, price — that
writes one row per ticked day. An overlap is refused by the constraint, and the
form names the band it collides with rather than reporting a failed save.

Copying a pitch's week onto another pitch is **not** in this round. With weekday
multi-select a pitch is configured in a few minutes; the duplication should be
observed hurting before a feature is added to hide it.

### 5.3 Closures — `/admin/chiusure`

Upcoming and past, each showing pitch-or-whole-club, period, and reason.
Creating one runs §2.4: preview the conflicts, confirm, then close and cancel
together. Deleting a closure reopens the period; it does not resurrect the
cancelled bookings, and says so.

### 5.4 The club — `/admin/struttura`

Identity — name, colour, phone, address — and the four booking rules:
`cancel_hours`, `booking_horizon_days`, `slot_minutes` (15, 30 or 60, as the
check constraint allows), `min_duration_minutes`.

The colour writes `--brand`, from which `index.css` derives the accent for both
schemes, so the theme moves as it is picked — light and dark at once. Writing
`--pitch` directly is what the phase-1B work had to undo; this screen must not
reintroduce it.

---

## 6. Error handling

Every message is Italian, and says what happened rather than that something did:

| Situation | What the panel says |
|---|---|
| Overlapping bands | names the conflicting band and its hours |
| Deleting a booked pitch (`23503`) | «Questo campo ha prenotazioni: puoi disattivarlo, non eliminarlo.» |
| Deactivating a pitch with future bookings | how many, and that closures are the way to shut it down |
| Closure over existing bookings | the list — who, when, how much — before anything is written |
| Write refused by RLS | a plain "not allowed", never a raw Postgres error |

One case is deliberately silent: editing bands so that a future slot is no
longer bookable. Existing bookings keep the `price_cents` already written and
remain valid, and warning on every edit would be noise around a non-event.

---

## 7. Out of scope

- **Feature flags.** §2.5.
- **Customer registry — create, edit, merge duplicates.** The third piece of the
  manager's tooling, and its own sub-project; merging duplicates in particular
  deserves its own design.
- **Notice board and reminder notifications.** The remaining sub-project.
- **Copying a week between pitches.** §5.2.
- **Explicit opening hours.** §2.1.
- **Multi-club administration.** One manager, one club, as everywhere else.

---

## 8. Risks

| Risk | Why it is worrying | Mitigation |
|---|---|---|
| The `weekday` migration silently drops bands | prices vanish, and PS005 makes pitches unbookable rather than free | the migration carries its own guard: it records every band's price for a probe minute of each of its weekdays, rewrites the table, recomputes, and raises if a single one moved — a migration that cannot silently lose a row is worth more than a test that runs after it already has |
| A closure cancels more than intended | a customer loses a booking nobody meant to touch | the preview is the same query the function uses, and the pgTAP test pins that only active bookings overlapping the period are touched |
| Reliability damaged by a club closure | a player is marked absent for the club's decision | the function never calls `cancel_booking` and never writes a counter; pgTAP asserts both counters are unchanged |
| An admin of another club writes here | the multi-tenant failure that matters commercially | policies already exist; the new function authorizes before acting, with the API-level test as evidence |

---

## 9. Verification

**pgTAP**, for what must hold with no interface in front of it:

- the exclusion constraint refuses an overlap on the same pitch and weekday, and
  permits the same hours on a different weekday or a different pitch;
- every price the seed can produce is still what it was: pgTAP pins
  `calc_booking_price` against expected values for a slot inside each band, at a
  band boundary, and across two bands. The *before and after* half of that claim
  cannot live in pgTAP — the suite only ever sees a migrated database — so it
  belongs in the migration itself, below;
- `create_closure` refuses a non-admin, cancels only active bookings overlapping
  the period, leaves `honored_count` and `missed_count` untouched, and is
  all-or-nothing.

**Vitest**, for the pure logic:

- the timeline builder — bands for a weekday become ordered segments with the
  gaps made explicit — including a day with no bands at all, a band touching
  midnight, and two adjacent bands that must not be drawn as one;
- the messages of §6.

**By hand**, added to `docs/come-provare.md`: configure a fourth pitch from
scratch, price it, close it for a day that has bookings, and watch those
bookings turn up cancelled in the customer's own history.

---

## References

- Project spec: `docs/superpowers/specs/2026-09-05-prenota-campi-design.md`
- Customer app (the sub-project before this one):
  `docs/superpowers/specs/2026-09-06-fase-1b-app-cliente-design.md`
- Mockups: `docs/mockups/`, two standalone HTML files

# Panel UI primitives — design spec

Three shared controls the app does not have — a select, a date/time field, and a
sortable list — plus the handful of fixes that stop being fixes once those exist.

Raised by the project's author after walking through the facility-configuration
panel. This spec covers all ten of the points raised, in one branch, because six
of them are symptoms of the other three.

> Written in English per the convention adopted on 11 September 2026. Every
> string a user reads stays Italian.

---

## 1. What we are building

The configuration panel works and is reviewed, but it is dressed in browser
defaults. Its selects wear the operating system's arrow and highlight; its date
fields are native controls whose intrinsic width bursts a dialog; its pitch list
reorders through ▲/▼ buttons. Against the rest of the product — which derives
every accent from the club's own colour and says everything in the club's own
words — those controls read as borrowed.

So: a `Select` and a date/time field of our own, a sortable list, and the
alignment and feedback fixes that the same pass makes obvious.

This is not a visual refresh. Nothing about the panel's layout, spacing scale or
vocabulary changes. What changes is that three controls stop being the browser's
and start being ours.

---

## 2. The decisions that hold this up

### 2.1 Headless libraries, not hand-rolled, and not a component kit

`@radix-ui/react-select`, `@radix-ui/react-popover`, `@dnd-kit/core` and
`@dnd-kit/sortable` — all four declare React 19 support, checked against npm
before this was written.

The parts of a select that are hard are the parts nobody sees: focus returning
to the trigger on close, Escape and arrow keys, typeahead, a popover that flips
when it would fall off a phone screen, the right ARIA roles so a screen reader
announces a list instead of a paragraph, and a drag that works with a finger and
with a keyboard rather than only a mouse. Those are what the libraries provide.

What they deliberately do not provide is any appearance. That stays entirely
ours: Tailwind classes and the same `--pitch` / `--pitch-tint` tokens everything
else uses, so a manager who sets the club's colour sees it in the dropdown too.

A styled component kit would have been the opposite trade — appearance for free,
and a fight to make it look like this product. Hand-rolling would have been the
other opposite: no dependency, and the invisible parts rebuilt badly. A select
that does not close on Escape looks finished.

### 2.2 Alignment is a token problem, not a per-field problem

Two padding scales live in the panel today — `px-2.5 py-2 text-[13.5px]` in
nineteen places and `px-3 py-1.5 text-[12.5px]` in sixteen. Stack an input above
a select and their text starts at different x. Fixing each site is how the
divergence happened.

A single `.field` class in `src/index.css`, beside the rules already there for
cursors and disabled buttons, owns the metrics: height, radius, border,
background, and padding. Inputs use it; so does the `Select` trigger. The two
line up by construction, and a future control that uses the class is aligned
before anyone checks.

Right padding stops being a special case at the same time. A native select
reserves room for the system arrow and paints it over the text; ours draws its
own chevron, so the padding is symmetric and explicit.

### 2.3 The dropdown is welded to the field

`position="popper"` with `sideOffset={-1}` and a width bound to
`--radix-select-trigger-width`. The panel appears as a continuation of the
control rather than a card hovering near it — the behaviour the author asked for
by name.

Items carry `cursor-pointer` and take their highlight from `--pitch-tint`.
Radix's `data-[highlighted]` covers mouse hover and keyboard navigation with one
rule, which is worth more than the styling: two rules for the same state drift,
and the keyboard one is the one nobody notices has drifted.

### 2.4 Our picker replaces the native one everywhere, including the customer app

The date field exists in four places: the closure dialog, the recurrence form's
"Fino al", the admin day-grid jump, and `DateJump` on the customer's `/prenota`.

Replacing three of four would leave the product with two pickers, which is the
inconsistency this work exists to remove. So all four, and this branch touches
customer-facing pages already on `main`.

There is a real cost, and it is not hypothetical: on a phone, `<input
type="date">` opens the operating system's own wheel — large, familiar, and free.
Ours has to be at least as usable with a thumb: touch targets no smaller than the
tab bar's, no dependence on hover, and a month grid that does not demand
precision. If it cannot meet that bar it is worse than what it replaces, and the
manual test guide gains a phone step that says so.

### 2.5 Reordering rewrites a range, and says so when it fails

The ▲/▼ buttons swap two `sort_order` values. A drag moves one pitch through a
list, which renumbers every position between the old and the new one.

That enlarges an already-recorded weakness: the swap was two non-transactional
writes, and a range is N. The answer is not a transaction — these are direct
table writes under RLS, and wrapping them would mean an RPC for a cosmetic
ordering. The answer is that the list must never lie: write the affected range,
and on any failure refetch and show the order the database actually holds, with
the failure said out loud. A wrong order the manager can see and redo is
recoverable; a wrong order the screen hides is not.

### 2.6 Feedback that does not sit on top of the controls

The toast is `position="top-center"`, directly over the settings tab bar, and it
intercepts clicks while it shows. Moving it to the bottom alone would recreate
the problem over whatever sits at the bottom, so it moves **and** becomes
dismissible: `position="bottom-center"` with `closeButton`.

---

## 3. What gets built

| File | Responsibility |
|---|---|
| `src/shared/components/ui/Select.tsx` | the select: trigger styled as a field, welded dropdown, themed items |
| `src/shared/components/ui/DateField.tsx` | a date, chosen from our own month grid in a popover |
| `src/shared/components/ui/TimeField.tsx` | a time of day, in minutes from midnight, from a quarter-hour list |
| `src/shared/components/ui/SortableList.tsx` | drag-to-reorder with a handle, over any list of ids |
| `src/index.css` | the `.field` class, the one home of form-control metrics |
| `src/shared/components/ui/Dialog.tsx` | modified: gains a `wide` size beside the current 420px |

`SortableList` owns the gesture and reports the new order; it never writes.
Persisting a reorder — and refetching when a write fails, per §2.5 — stays with
the screen that owns the data.

`DateField` and `TimeField` stay separate. The closure dialog needs both at once
and the recurrence form needs only a date; one combined control would carry a
mode flag, and a component with a mode is two components sharing a file.

Both speak the project's units. `TimeField` takes and returns **minutes from
midnight**; `step` defaults to 15, the finest `slot_minutes` the database
allows, so every boundary a booking can land on stays reachable, and `1440` is
expressible — precisely the value no native time control could offer.
`DateField` takes and returns a `Date` at **noon in the device's own zone**,
the convention `DateJump` already uses to stop a day sliding across a
timezone boundary. Local, not Rome: the value never names an instant, only a
day, and noon is simply the widest margin on either side of it — a bare day
held at midnight can fall into the day before the moment a conversion touches
it. `monthGrid` builds the grid that way (`setHours(12, 0, 0, 0)`).

### 3.1 An impossible choice is disabled, never absent

Both fields take `min` and `max`, and both **grey out** what falls outside them
rather than omitting it. A greyed option says "this exists and you cannot have
it now"; a missing one says nothing, and leaves the manager wondering whether
they looked properly. It is also one mechanism instead of two — the same prop
serves a structural limit and a relational one.

The relational limits are the point of this section, and there are two:

- **within a pair of times**, the end cannot be at or before the start. The end
  field's `min` is the start plus one `step`, so choosing 02:45 as a start greys
  everything up to and including 02:45 in the end list;
- **within a pair of instants** — the closure dialog, which has a date and a
  time on each side — the end date's `min` is the start date, and the end
  **time** is constrained only when both fall on the same day. On a later day
  any hour is legitimate, and greying the morning would be wrong.

The constraint travels one way, from start to end. Moving a start above an
already-chosen end is allowed, and leaves the end invalid rather than silently
rewriting it: the form then refuses to submit and says why. Rewriting a value
the manager chose, because a different field moved, is the behaviour that makes
people distrust a form.

---

## 4. What gets fixed

- **The toast**, per §2.6.
- **The timeline's clipped borders.** `DayTimeline` wraps its row in a container
  with `overflow-hidden`, its own border and rounded corners, while each segment
  inside carries `border border-pitch`. The children's borders land under the
  parent's and are cut. The row keeps the outer border; segments get a left
  separator only. Nothing inside draws a border the container will clip.
- **The closure dialog's horizontal scroll.** Caused by two `datetime-local`
  controls whose intrinsic minimum width exceeds the dialog's 420px. It
  disappears when §2.4 lands. `Dialog` also gains a `wide` size, because the
  conflict list is a list and 420px is tight for it regardless.
- **«Aggiorna le tariffe di questo campo»** in the pitch edit dialog, navigating
  to `/tariffe?campo=<id>`; `PriceBandsPage` reads the parameter instead of
  always selecting the first pitch.

---

## 5. Out of scope

- **Any change to layout, spacing scale or copy** beyond the alignment fix. This
  is not a redesign.
- **A component kit or design-system package.** Four primitives, added because
  four were needed.
- **Replacing `<input type="text">`, `<textarea>` or the checkbox.** They are not
  broken and the `.field` class reaches them without rewriting them.
- **Theming the toast library.** Position and dismissibility only.
- **The non-transactional reorder becoming an RPC.** §2.5.

---

## 6. Risks

| Risk | Why it is worrying | Mitigation |
|---|---|---|
| Our picker is worse than the OS wheel on a phone | it replaces something genuinely good, on the device most customers use | touch targets sized against the existing tab bar, no hover dependence, and a phone step in `docs/come-provare.md` that has to pass before merge |
| A drag that works with a mouse and not a finger or a keyboard | the panel is used on a phone, and ▲/▼ at least worked everywhere | dnd-kit's pointer, touch and keyboard sensors all enabled, each exercised |
| Three bundled dependencies on a PWA | the app is installable and must stay light | **Measured, after a correction that matters more than the number.** Every early baseline build — including the controller's own — ran in a worktree without `.env.local`. That file is git-ignored, so a fresh checkout lacks it, and without credentials the bundler dead-code-eliminates all of `@supabase/supabase-js`; the baseline looked far smaller than it is, and two wrong figures (+28%, +122%) were reported to the author before anyone noticed. Rebuilt with the file in place: the pre-work commit `6898313` precaches **673.77 KiB**; this branch precaches **684.09 KiB** — **+10.32 KiB, +1.5%**, well inside the threshold. The customer's entry chunk is *smaller* than before the work, 596.56 kB → 554.99 kB, because the chunk split moved the manager's panel out of it: the precache now holds 11 entries and **zero admin chunks**, confirmed by decoding `dist/sw.js`. A customer no longer downloads the panel they cannot open. |
| Replacing `DateJump` regresses the customer's booking page | it is on `main` and it works | the existing `DayStrip`/`BookPage` tests are the guard; they must pass untouched |
| `.field` changes the look of controls it is applied to | a shared class touches every form at once | applied deliberately per control, with the panel walked screen by screen |

---

## 7. Verification

- **Vitest** for what is pure or contractual: the `Select` renders its options
  and reports a choice; `TimeField` maps a label to minutes and back, `1440`
  included; `DateField` returns noon local; `SortableList` produces the right
  order from a move. Keyboard behaviour that belongs to the libraries is theirs
  to test, not ours — we test that we wired them.
- **The existing suites are the regression guard** for §2.4's reach into the
  customer app: `BookPage`, `DayStrip` and the booking flow tests pass unchanged.
- **By hand, on a phone**, added to `docs/come-provare.md`: pick a date, pick a
  time, reorder two pitches with a finger. If any of the three is worse than what
  it replaced, it is not done.

---

## References

- Facility configuration (the panel this dresses):
  `docs/superpowers/specs/2026-09-11-facility-configuration-design.md`
- Project spec: `docs/superpowers/specs/2026-09-05-prenota-campi-design.md`
- Mockups: `docs/mockups/`

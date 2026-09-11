# Panel UI Primitives Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app a select, a date field, a time field and a sortable list of its own, so the configuration panel stops wearing the browser's controls — and fix the four smaller things the same pass makes obvious.

**Architecture:** Headless libraries for the invisible parts (Radix UI for select and popover, dnd-kit for dragging), all appearance ours through Tailwind and the existing `--pitch` tokens. One `.field` class in `src/index.css` owns form-control metrics so inputs and select triggers align by construction rather than by discipline. Quick fixes land first so the panel improves before the component work begins.

**Tech Stack:** React 19 · TypeScript · Vite 8 · Tailwind 4 (config in `src/index.css`, no `tailwind.config`) · TanStack Query v5 · React Router 7 · date-fns / date-fns-tz · Vitest · `@radix-ui/react-select` 2.3.7 · `@radix-ui/react-popover` 1.1.23 · `@dnd-kit/core` 6.3.1 · `@dnd-kit/sortable` 10.0.0 (all four declare React 19 support)

**Spec:** `docs/superpowers/specs/2026-09-11-ui-primitives-design.md`

## Global Constraints

- Identifiers in English; **every string a user reads is Italian**. Comments in new code, commit messages and docs are English.
- Queries live in `hooks/`, one per file, name starting with `use`. Pure logic lives in `utils/`. Components do not contain queries. Tests sit beside the file they prove.
- Imports use `@/...` across a feature boundary or into `shared/`; relative only within the same folder. A component two areas need lives in `shared/components/ui/`.
- Money in cents (`integer`). Times of day in **minutes from midnight**, `0..1440`. Instants are `timestamptz`; reference zone `Europe/Rome` from `src/shared/lib/tz.ts`.
- Every write proves it wrote: a PostgREST write whose RLS `using` clause excludes the row matches zero rows and returns **no error**. Five mutations on this branch already follow it — do not weaken any.
- Typecheck with `npx tsc -b`. **`npx tsc --noEmit` checks nothing in this repo** — the root `tsconfig.json` has `"files": []`, so it exits 0 without reading a file.
- Colour comes from `--brand`, from which `index.css` derives `--pitch` and `--pitch-tint` per scheme. **Never write `--pitch` directly.**
- This machine is shared with other projects. Never run `docker … prune` or `pkill -f vite`; kill only a PID verified with `/proc/<pid>/cwd`. `npm run dev` uses port 5174.
- The branch is `feat/facility-configuration`, already checked out, head `0b78217`. Baseline: **150 unit tests, 82 pgTAP**, `tsc -b`, lint and build all clean.

---

### Task 1: The four small fixes

None of these needs a new component, and all four are visible immediately. Spec §2.6 and §4.

**Files:**
- Modify: `src/App.tsx:65` — the toast
- Modify: `src/features/admin/components/DayTimeline.tsx:56-73` — the clipped borders
- Modify: `src/features/admin/components/FieldsPage.tsx` — the "update the prices" entry in the edit dialog
- Modify: `src/features/admin/components/PriceBandsPage.tsx` — read `?campo=` instead of always selecting the first pitch
- Create: `src/features/admin/utils/preselectedField.ts`
- Create: `src/features/admin/utils/preselectedField.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `preselectedField(param: string | null, fields: {id: string}[]): string | null` — the pitch a URL asks for, or null when it asks for nothing or for one that does not exist.

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/utils/preselectedField.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { preselectedField } from './preselectedField'

const fields = [{ id: 'a' }, { id: 'b' }]

describe('preselectedField', () => {
  it('picks the pitch the URL names', () => {
    expect(preselectedField('b', fields)).toBe('b')
  })

  it('ignores a pitch that does not exist', () => {
    // A stale link, or a pitch deleted since. Falling back to null lets the
    // page choose its own default rather than selecting nothing at all.
    expect(preselectedField('zzz', fields)).toBeNull()
  })

  it('ignores an absent parameter', () => {
    expect(preselectedField(null, fields)).toBeNull()
    expect(preselectedField('', fields)).toBeNull()
  })

  it('ignores everything while the pitches are still loading', () => {
    expect(preselectedField('b', [])).toBeNull()
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- src/features/admin/utils/preselectedField.test.ts`
Expected: FAIL — cannot resolve `./preselectedField`.

- [ ] **Step 3: Write it**

```ts
/**
 * The pitch a URL asks the prices screen to open, or null.
 *
 * Null rather than a thrown error for a pitch that does not exist: the link
 * may be old, or the pitch deleted since it was made, and a manager following
 * a stale link should land on a working screen rather than an explanation.
 */
export function preselectedField(
  param: string | null,
  fields: { id: string }[],
): string | null {
  if (!param) return null
  return fields.some((f) => f.id === param) ? param : null
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- src/features/admin/utils/preselectedField.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Move the toast and make it dismissible**

`src/App.tsx:65`:

```tsx
{/* Bottom, and closable. Top-center sat directly over the settings tab bar
    and swallowed clicks while it showed; moving it alone would recreate that
    over whatever sits at the bottom, so it also gains a close button. */}
<Toaster richColors position="bottom-center" closeButton />
```

- [ ] **Step 6: Stop the timeline clipping its segments' borders**

`src/features/admin/components/DayTimeline.tsx`. The row is
`<div className="flex h-9 flex-1 overflow-hidden rounded-lg border border-line-soft">` and every segment inside carries `border border-pitch`. The children's borders land under the parent's and are cut off.

The row keeps the outer border and the clipping — it needs both for the rounded corners. The segments stop drawing a full border and take a separator instead:

- open segments: replace `border border-pitch` with `border-l border-pitch/40 first:border-l-0`, keeping `bg-pitch-tint` and the text colour, so a band still reads as a band;
- closed segments: add the same `border-l border-line-soft first:border-l-0` so the seam between a closed stretch and its neighbour is visible too.

Open the screen and confirm before moving on: every segment's edges must be visible at both ends of the row, including the first and the last. The reported symptom was that the right, top and bottom edges of the leftmost price button were invisible — check that exact case, and if what you see differs from that description, say so in your report rather than declaring it fixed.

- [ ] **Step 7: Add the prices entry to the pitch edit dialog**

In `FieldsPage.tsx`, inside the edit dialog (not the create one — a pitch that does not exist yet has no prices), add a link below the form fields:

```tsx
<Link
  to={`/admin/tariffe?campo=${field.id}`}
  className="text-[13px] font-medium text-pitch underline transition-colors hover:text-pitch-strong"
>
  Aggiorna le tariffe di questo campo →
</Link>
```

- [ ] **Step 8: Have the prices screen honour it**

In `PriceBandsPage.tsx`, the effect that currently selects the first pitch consults the URL first:

```tsx
const [params] = useSearchParams()
// …inside the effect that picks a default pitch:
setFieldId((current) => current ?? preselectedField(params.get('campo'), fields) ?? fields[0]?.id ?? null)
```

Keep the existing fallback exactly as it is — an absent or unknown parameter must leave today's behaviour untouched.

- [ ] **Step 9: Verify and commit**

Run: `npx tsc -b && npm run test && npm run lint`
Expected: PASS, 154 tests (150 + 4).

Open `/admin/campi`, edit a pitch, follow the link, and confirm the prices screen opens on that pitch and not the first.

```bash
git add src/App.tsx src/features/admin/components/DayTimeline.tsx \
        src/features/admin/components/FieldsPage.tsx src/features/admin/components/PriceBandsPage.tsx \
        src/features/admin/utils/preselectedField.ts src/features/admin/utils/preselectedField.test.ts
git commit -m "fix(admin): toast out of the way, timeline borders whole, prices one click from a pitch"
```

---

### Task 2: `.field`, and a select of our own

Spec §2.1, §2.2 and §2.3. The component; adopting it is Task 3.

**Files:**
- Modify: `package.json` — add `@radix-ui/react-select`
- Modify: `src/index.css` — the `.field` class
- Create: `src/shared/components/ui/Select.tsx`
- Create: `src/shared/components/ui/Select.test.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:

```ts
export type SelectOption<T extends string> = { value: T; label: string; disabled?: boolean }

export function Select<T extends string>(props: {
  value: T
  onChange: (value: T) => void
  options: SelectOption<T>[]
  'aria-label'?: string
  id?: string
  disabled?: boolean
  className?: string
}): JSX.Element
```

Tasks 3 and 5 use exactly this.

- [ ] **Step 1: Install the dependency**

Run: `npm install @radix-ui/react-select@2.3.7`
Expected: installs without a peer-dependency warning about React. If npm reports one, stop and report it — the spec's compatibility claim was checked and a warning would mean it is wrong.

- [ ] **Step 2: Write the failing test**

Create `src/shared/components/ui/Select.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

const options = [
  { value: 'calcio5', label: 'Calcio a 5' },
  { value: 'calcio7', label: 'Calcio a 7' },
]

describe('Select', () => {
  it('shows the label of the current value, not its code', () => {
    render(<Select value="calcio7" onChange={() => {}} options={options} aria-label="Tipo" />)
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveTextContent('Calcio a 7')
  })

  it('reports the chosen value', () => {
    const onChange = vi.fn()
    render(<Select value="calcio5" onChange={onChange} options={options} aria-label="Tipo" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Tipo' }))
    fireEvent.click(screen.getByRole('option', { name: 'Calcio a 7' }))

    expect(onChange).toHaveBeenCalledWith('calcio7')
  })

  it('is a combobox a screen reader can name', () => {
    render(<Select value="calcio5" onChange={() => {}} options={options} aria-label="Tipo di campo" />)
    expect(screen.getByRole('combobox', { name: 'Tipo di campo' })).toBeInTheDocument()
  })

  it('cannot be opened when disabled', () => {
    render(<Select value="calcio5" onChange={() => {}} options={options} aria-label="Tipo" disabled />)
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toBeDisabled()
  })
})
```

Radix's select needs two jsdom APIs that do not exist there. Add them to `src/test/setup.ts` beside the `ResizeObserver` and pointer-capture stubs already there, with the same reasoning in the comment — they are gaps in the test environment, not in the product:

```ts
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function scrollIntoView() {}
}
if (!globalThis.DOMRect) {
  globalThis.DOMRect = class {
    constructor(public x = 0, public y = 0, public width = 0, public height = 0) {}
    top = 0; right = 0; bottom = 0; left = 0
    static fromRect() { return new globalThis.DOMRect() }
    toJSON() { return {} }
  } as unknown as typeof DOMRect
}
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npm run test -- src/shared/components/ui/Select.test.tsx`
Expected: FAIL — cannot resolve `./Select`.

- [ ] **Step 4: Add the `.field` class**

In `src/index.css`, after the `button:disabled` block and before `body`:

```css
/* The metrics of every form control, in one place.
   Two padding scales had grown side by side in the panel — `px-2.5 py-2` in
   nineteen places and `px-3 py-1.5` in sixteen — so an input stacked above a
   select started its text at a different x. Fixing each site is how they
   diverged; a shared class makes them agree by construction, and a control
   written later is aligned before anyone checks.
   Padding is symmetric: a native select paints the system arrow over its own
   text, which is why the right side used to need special treatment. Ours
   draws its own chevron inside this padding. */
@layer components {
  .field {
    display: flex;
    align-items: center;
    width: 100%;
    height: 2.25rem;
    padding-inline: 0.75rem;
    border: 1px solid var(--line);
    border-radius: 7px;
    background: var(--surface-2);
    color: var(--ink);
    font-size: 13.5px;
    outline: none;
  }
  .field:focus,
  .field:focus-visible,
  .field[data-state="open"] {
    border-color: var(--pitch);
  }
}
```

- [ ] **Step 5: Write the Select**

Create `src/shared/components/ui/Select.tsx`. It wraps `@radix-ui/react-select`; the doc comment must say why the library is here, in the spec's terms — the invisible parts (focus return, Escape, arrows, typeahead, flipping on a small screen, ARIA roles), not the appearance.

Requirements, all of them load-bearing:

- the trigger uses `.field` plus `justify-between`, so it is the same box as an input. It renders `<Select.Value />` and a chevron drawn inline as SVG with `stroke="currentColor"`;
- the content uses `position="popper"`, `sideOffset={-1}`, and `width: var(--radix-select-trigger-width)` so the panel is exactly as wide as the field and welded to it;
- `className` on the content: `z-50 overflow-hidden rounded-b-[7px] border border-pitch bg-surface shadow-card`, with `max-h-[min(18rem,var(--radix-select-content-available-height))]` and a scrollable viewport, because the time list has 97 options;
- items: `cursor-pointer select-none px-3 py-2 text-[13.5px] text-ink outline-none` plus `data-[highlighted]:bg-pitch-tint data-[highlighted]:text-pitch`. **One rule for mouse and keyboard** — `data-[highlighted]` is set for both, and two rules for the same state drift;
- `data-[disabled]` items are `text-muted` and not choosable;
- the whole control is unstyled by Radix: no `Select.Icon` defaults, no portal theming beyond the classes above.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- src/shared/components/ui/Select.test.tsx`
Expected: PASS, 4 tests.

- [ ] **Step 7: Verify and commit**

Run: `npx tsc -b && npm run test && npm run lint && npm run build`
Expected: PASS, 158 tests (154 + 4).

```bash
git add package.json package-lock.json src/index.css src/test/setup.ts \
        src/shared/components/ui/Select.tsx src/shared/components/ui/Select.test.tsx
git commit -m "feat(ui): a select of our own, and one home for field metrics"
```

---

### Task 3: Adopt the select, and the alignment that comes with it

**Five** native `<select>` elements across four files, and the inputs beside
them. (A `grep` for `<select` reports six; the sixth is a mention inside a
comment in `BandDialog.tsx:19`. Counting it would have sent you looking for a
control that does not exist.)

**Files:**
- Modify: `src/features/admin/components/BandDialog.tsx:173,187` — two: «Dalle» and «Alle», the quarter-hour lists
- Modify: `src/features/admin/components/FacilityPage.tsx` — one: `slot_minutes`
- Modify: `src/features/admin/components/FieldsPage.tsx` — one: the pitch kind
- Modify: `src/features/admin/components/NewClosureDialog.tsx` — one: the pitch, with «Tutto l'impianto» as the first option

**Interfaces:**
- Consumes: `Select`, `SelectOption` and the `.field` class from Task 2.
- Produces: nothing new.

- [ ] **Step 1: Replace each native select**

For each of the five, build the `options` array from what the `<option>` elements say today — **the Italian labels must survive verbatim**, including «Tutto l'impianto» in the closure dialog and the `1h` / `1h 30` / `2h` style wording wherever it appears. Keep each control's `aria-label` or its associated `<label>`; a select that loses its name is a regression a test will not catch.

`slot_minutes` in `FacilityPage` must still offer exactly 15, 30 and 60 — the database check constraint allows no others — and its values are numbers, so convert at the edge rather than widening `Select` to non-string values.

- [ ] **Step 2: Put every text input on `.field`**

In the same four files, every `<input type="text">`, `<input type="number">` and `<textarea>` that sits in a form with a select takes `className="field"`, dropping its own `px-…`/`border`/`rounded-…`/`bg-…` utilities. Keep utilities that are not metrics — `tabular-nums`, `text-right`, a width constraint.

The point of the task is that a column of controls lines up. After the edit, open each dialog and look down the left edge of the fields: if any text starts at a different x, the class was not applied there.

- [ ] **Step 3: Verify and commit**

Run: `npx tsc -b && npm run test && npm run lint`
Expected: PASS, 158 tests, unchanged. Existing dialog tests must pass untouched — `BandDialog.test.tsx` drives the time selects, so if it needs a change beyond query syntax, stop and report: that would mean behaviour moved, not markup.

Walk all four screens in the browser: open every dialog, choose from every select with the mouse **and** with the keyboard (Tab to it, Enter, arrows, Enter), and confirm the dropdown is welded to the field, the highlight is the club's green rather than the system blue, and the pointer is a hand over the options.

```bash
git add src/features/admin/components/BandDialog.tsx src/features/admin/components/FacilityPage.tsx \
        src/features/admin/components/FieldsPage.tsx src/features/admin/components/NewClosureDialog.tsx
git commit -m "refactor(admin): the panel's selects and inputs are ours, and aligned"
```

---

### Task 4: A date field and a time field

Spec §2.4 and §3. The components; adopting them is Task 5.

**Files:**
- Modify: `package.json` — add `@radix-ui/react-popover`
- Create: `src/shared/components/ui/DateField.tsx`
- Create: `src/shared/components/ui/DateField.test.tsx`
- Create: `src/shared/components/ui/TimeField.tsx`
- Create: `src/shared/components/ui/TimeField.test.tsx`
- Create: `src/shared/components/ui/monthGrid.ts`
- Create: `src/shared/components/ui/monthGrid.test.ts`

**Interfaces:**
- Consumes: `Select` from Task 2 (`TimeField` is a `Select` over a computed list — do not rebuild a listbox).
- Produces:

```ts
export function DateField(props: {
  value: Date | null
  onChange: (d: Date) => void
  min?: Date
  max?: Date
  'aria-label': string
  id?: string
}): JSX.Element

export function TimeField(props: {
  value: number            // minutes from midnight
  onChange: (min: number) => void
  min?: number             // default 0 — below it, options are DISABLED, not removed
  max?: number             // default 1440 — above it, likewise
  step?: number            // default 15
  'aria-label': string
  id?: string
}): JSX.Element

export function monthGrid(month: Date): Date[]   // 42 days, Monday-first, noon Rome
```

- [ ] **Step 1: Write the failing test for the grid**

Create `src/shared/components/ui/monthGrid.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { monthGrid } from './monthGrid'

describe('monthGrid', () => {
  it('always returns six whole weeks', () => {
    // A fixed number of cells keeps the popover from resizing as the month
    // changes, which is what makes a calendar feel like it jumps.
    expect(monthGrid(new Date('2026-09-15T12:00:00+02:00'))).toHaveLength(42)
    expect(monthGrid(new Date('2026-02-15T12:00:00+01:00'))).toHaveLength(42)
  })

  it('starts on the Monday on or before the first of the month', () => {
    // 1 September 2026 is a Tuesday, so the grid opens on Monday the 31st.
    const grid = monthGrid(new Date('2026-09-15T12:00:00+02:00'))
    expect(grid[0].getDate()).toBe(31)
    expect(grid[0].getMonth()).toBe(7) // August
  })

  it('puts every day at noon, so a timezone cannot shift it', () => {
    for (const d of monthGrid(new Date('2026-09-15T12:00:00+02:00'))) {
      expect(d.getHours()).toBe(12)
    }
  })

  it('contains every day of the month it is given', () => {
    const grid = monthGrid(new Date('2026-09-15T12:00:00+02:00'))
    const september = grid.filter((d) => d.getMonth() === 8)
    expect(september).toHaveLength(30)
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- src/shared/components/ui/monthGrid.test.ts`
Expected: FAIL — cannot resolve `./monthGrid`.

- [ ] **Step 3: Write the grid**

Use `startOfMonth`, `startOfWeek` with `{ weekStartsOn: 1 }`, and `addDays` from date-fns; build 42 days and set each to 12:00 local. The doc comment explains both choices: six weeks so the popover never resizes, noon so a day cannot slide across a timezone boundary — the same reasoning `DateJump` already carries.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- src/shared/components/ui/monthGrid.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write TimeField and its test**

`TimeField` is a `Select` whose options run the **whole day** at `step`
intervals — `0` to `1440` inclusive — labelled with `minToLabel` from
`@/shared/lib/tz` and valued with the minute count as a string. It converts at
its own edge so its callers keep speaking minutes.

`min` and `max` do **not** shorten that list: they mark everything outside them
`disabled`. Spec §3.1 — a greyed option says "this exists and you cannot have it
now", a missing one says nothing. `Select` already carries `disabled` per option
and styles it `data-[disabled]:text-muted`, so this is a flag, not new
machinery.

Create `src/shared/components/ui/TimeField.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimeField } from './TimeField'

describe('TimeField', () => {
  it('shows the current minute as a time', () => {
    render(<TimeField value={1140} onChange={() => {}} aria-label="Dalle" />)
    expect(screen.getByRole('combobox', { name: 'Dalle' })).toHaveTextContent('19:00')
  })

  it('offers midnight as an end, which no native time input could', () => {
    render(<TimeField value={1440} onChange={() => {}} min={15} max={1440} aria-label="Alle" />)
    expect(screen.getByRole('combobox', { name: 'Alle' })).toHaveTextContent('24:00')
  })

  it('reports minutes, not a label', () => {
    const onChange = vi.fn()
    render(<TimeField value={540} onChange={onChange} aria-label="Dalle" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Dalle' }))
    fireEvent.click(screen.getByRole('option', { name: '09:15' }))

    expect(onChange).toHaveBeenCalledWith(555)
  })

  it('greys what is out of bounds instead of hiding it', () => {
    // Spec §3.1. The whole day is still listed; only what cannot be chosen
    // right now is disabled. A test asserting a shorter list would be
    // asserting the old behaviour.
    render(<TimeField value={0} onChange={() => {}} min={0} max={60} step={30} aria-label="Dalle" />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Dalle' }))

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(49) // 00:00 … 24:00 every 30 minutes
    expect(screen.getByRole('option', { name: '01:00' })).not.toHaveAttribute('data-disabled')
    expect(screen.getByRole('option', { name: '01:30' })).toHaveAttribute('data-disabled')
  })

  it('cannot end at or before it starts', () => {
    // The relational rule of spec §3.1: an end field whose `min` is the start
    // plus one step greys the start itself, because a band of zero length is
    // not a band.
    render(<TimeField value={1440} onChange={() => {}} min={180} step={15} aria-label="Alle" />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Alle' }))

    expect(screen.getByRole('option', { name: '02:45' })).toHaveAttribute('data-disabled')
    expect(screen.getByRole('option', { name: '03:00' })).not.toHaveAttribute('data-disabled')
  })
})
```

- [ ] **Step 6: Write DateField and its test**

`DateField` is a `@radix-ui/react-popover` whose trigger is a `.field`-styled button showing the date in Italian (`format(value, 'd MMMM yyyy', { locale: it })`) or a placeholder, and whose content is `monthGrid` rendered as a 7-column grid with a month header and ‹ › buttons.

Requirements:
- every day cell is at least **44×44px** — the spec's bar is "no smaller than the tab bar", which is `--spacing-tabbar`, 3.5rem. Nothing here may depend on hover;
- the selected day uses `bg-pitch text-on-pitch`; today is marked with a ring, not a colour, so the two are distinguishable;
- days outside `min`/`max` are disabled and `text-muted`;
- choosing a day calls `onChange` with that day at noon and closes the popover;
- the grid is keyboard reachable: the trigger opens with Enter, arrows move between days, Escape closes. Radix's popover gives focus management; day-to-day movement is ours — a `roving tabindex` over the cells is enough.

Create `src/shared/components/ui/DateField.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateField } from './DateField'

const sept15 = new Date('2026-09-15T12:00:00+02:00')

describe('DateField', () => {
  it('shows the current value in Italian', () => {
    render(<DateField value={sept15} onChange={() => {}} aria-label="Dal" />)
    expect(screen.getByRole('button', { name: /Dal/ })).toHaveTextContent('15 settembre 2026')
  })

  it('opens on the month of the current value', () => {
    render(<DateField value={sept15} onChange={() => {}} aria-label="Dal" />)
    fireEvent.click(screen.getByRole('button', { name: /Dal/ }))
    expect(screen.getByText(/settembre 2026/i)).toBeInTheDocument()
  })

  it('reports the chosen day at noon, so no timezone can shift it', () => {
    const onChange = vi.fn()
    render(<DateField value={sept15} onChange={onChange} aria-label="Dal" />)

    fireEvent.click(screen.getByRole('button', { name: /Dal/ }))
    fireEvent.click(screen.getByRole('button', { name: '18' }))

    const chosen = onChange.mock.calls[0][0] as Date
    expect(chosen.getDate()).toBe(18)
    expect(chosen.getHours()).toBe(12)
  })

  it('refuses a day beyond max', () => {
    render(
      <DateField
        value={sept15}
        onChange={() => {}}
        max={new Date('2026-09-20T12:00:00+02:00')}
        aria-label="Dal"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Dal/ }))
    expect(screen.getByRole('button', { name: '25' })).toBeDisabled()
  })
})
```

- [ ] **Step 7: Verify and commit**

Run: `npx tsc -b && npm run test && npm run lint && npm run build`
Expected: PASS, 171 tests (158 + 4 grid + 5 time + 4 date).

```bash
git add package.json package-lock.json src/shared/components/ui/DateField.tsx \
        src/shared/components/ui/DateField.test.tsx src/shared/components/ui/TimeField.tsx \
        src/shared/components/ui/TimeField.test.tsx src/shared/components/ui/monthGrid.ts \
        src/shared/components/ui/monthGrid.test.ts
git commit -m "feat(ui): a date field and a time field that speak our units"
```

---

### Task 5: Adopt the pickers — including on the customer's page

Spec §2.4. Three files hold every native date control: `DateJump` is one component used by both `/prenota` and `/admin`, so the "four places" of the spec are three files.

**Files:**
- Modify: `src/shared/components/ui/DateJump.tsx` — the icon-and-popover jump, used by `BookPage` and `AdminPage`
- Modify: `src/features/admin/components/RecurrenceForm.tsx:39` — «Fino al»
- Modify: `src/features/admin/components/NewClosureDialog.tsx:108,118` — two `datetime-local`, which become `DateField` + `TimeField` side by side
- Modify: `src/shared/components/ui/Dialog.tsx:35` — a `wide` size
- Modify: `src/features/admin/components/BandDialog.tsx` — its two time selects become `TimeField`

**Interfaces:**
- Consumes: `DateField`, `TimeField` from Task 4.
- Produces: `Dialog` gains `size?: 'default' | 'wide'`, default `420px`, wide `min(640px, calc(100vw-2rem))`.

- [ ] **Step 1: Widen the dialog where it needs it**

`Dialog.tsx:35` takes a `size` prop; `NewClosureDialog` passes `wide`. Everything else keeps today's width by default — this must not become a global change.

- [ ] **Step 2: Replace the closure dialog's two `datetime-local` controls**

Each instant becomes a `DateField` and a `TimeField` beside it, in a `flex flex-wrap gap-2` so they stack rather than overflow on a narrow screen. The pair maps to one `Date`: take the day from the date field and the minutes from the time field, in `Europe/Rome`, using the helpers in `src/shared/lib/tz.ts` — `localInputToDate` is the existing path for reading a wall-clock value, and the conversion must keep going through it or its equivalent rather than a fresh `new Date(...)`.

**The two instants must be coherent**, per spec §3.1:
- the end `DateField` takes `min={startDate}` — an earlier day is greyed in the
  calendar;
- the end `TimeField` takes `min={startMin + 15}` **only when the two dates are
  the same day**, and no relational `min` otherwise. On a later day any hour is
  legitimate, and greying the morning would be wrong — this is the case that is
  easy to get wrong by applying the rule unconditionally.

This is what removes the horizontal scroll the author reported: the native control's intrinsic minimum width is what burst the 420px dialog.

- [ ] **Step 3: Replace `RecurrenceForm`'s «Fino al»**

One `DateField`. Its `min` is the recurrence's start date — the form already knows it.

- [ ] **Step 4: Rebuild `DateJump` on `DateField`**

`DateJump` keeps its shape: an icon button with the tooltip «Scegli una data», themed from `text-ink-2` to `hover:text-pitch`, opening a picker with `min`/`max`. What changes is what opens — our popover rather than `showPicker()` — which also removes the `CAN_SHOW_PICKER` feature detection and the hidden-input trick the old version needed.

**This is the customer-facing change.** `src/features/booking/components/DayStrip.test.tsx` and `BookPage.test.tsx` are the guard. They must still pass; if a query in them needs updating because the control is no longer an `<input type="date">`, that is expected — but the *behaviour* they assert must not change, and if you find yourself weakening an assertion, stop and report it.

- [ ] **Step 5: Replace `BandDialog`'s time selects, and make the pair coherent**

They already produce minutes via `labelToMin`; `TimeField` does that conversion
itself, so the component gets simpler.

Bounds, per spec §3.1 — these now **grey** rather than shorten:
- start: `min={0} max={1425}`;
- end: `min={startMin + 15} max={1440}` — the relational rule. Choosing 02:45 as
  a start greys everything up to and including 02:45 in the end list, because a
  band of zero length is not a band.

The constraint runs one way only. Moving the start above an already-chosen end
leaves the end invalid rather than rewriting it; the form already refuses to
submit an end that is not after its start, and that message is what the manager
should see. Do not silently adjust a value the manager chose because another
field moved.

- [ ] **Step 6: Verify and commit**

Run: `npx tsc -b && npm run test && npm run test:db && npm run lint && npm run build`
Expected: PASS, 170 tests, 82 pgTAP.

In the browser, and this is the step that matters most in the whole plan:
- open a closure and confirm the dialog **no longer scrolls sideways** with both instants set;
- set a band to end at `24:00` and confirm it saves and redraws to midnight;
- on `/prenota` as a customer, jump to a date and confirm the strip moves — this is the page that was working before this branch touched it.

```bash
git add src/shared/components/ui/DateJump.tsx src/shared/components/ui/Dialog.tsx \
        src/features/admin/components/RecurrenceForm.tsx src/features/admin/components/NewClosureDialog.tsx \
        src/features/admin/components/BandDialog.tsx
git commit -m "refactor: every date and time is picked with our own control"
```

---

### Task 6: Drag a pitch into place

Spec §2.5.

**Files:**
- Modify: `package.json` — add `@dnd-kit/core` and `@dnd-kit/sortable`
- Create: `src/shared/components/ui/SortableList.tsx`
- Create: `src/features/admin/utils/reorder.ts`
- Create: `src/features/admin/utils/reorder.test.ts`
- Modify: `src/features/admin/components/FieldsPage.tsx` — the handle replaces ▲/▼
- Modify: `src/features/admin/hooks/useAdminFields.ts` — a range rewrite replaces the swap

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `SortableList<T extends {id: string}>({ items, onReorder, renderItem })` — owns the gesture, never writes;
  - `reorder<T>(items: T[], from: number, to: number): T[]` and `sortOrderPatches(items: {id: string; sort_order: number}[]): {id: string; sort_order: number}[]` — the rows whose `sort_order` actually changed.

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/utils/reorder.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { reorder, sortOrderPatches } from './reorder'

const a = { id: 'a', sort_order: 1 }
const b = { id: 'b', sort_order: 2 }
const c = { id: 'c', sort_order: 3 }

describe('reorder', () => {
  it('moves an item down', () => {
    expect(reorder([a, b, c], 0, 2).map((f) => f.id)).toEqual(['b', 'c', 'a'])
  })

  it('moves an item up', () => {
    expect(reorder([a, b, c], 2, 0).map((f) => f.id)).toEqual(['c', 'a', 'b'])
  })

  it('a move to the same place changes nothing', () => {
    expect(reorder([a, b, c], 1, 1).map((f) => f.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('sortOrderPatches', () => {
  it('renumbers positions from one', () => {
    expect(sortOrderPatches([c, a, b])).toEqual([
      { id: 'c', sort_order: 1 },
      { id: 'a', sort_order: 2 },
      { id: 'b', sort_order: 3 },
    ])
  })

  it('returns only the rows that actually move', () => {
    // Dragging the last pitch one place up must not rewrite the first.
    expect(sortOrderPatches([a, c, b])).toEqual([
      { id: 'c', sort_order: 2 },
      { id: 'b', sort_order: 3 },
    ])
  })

  it('returns nothing when the order is already right', () => {
    expect(sortOrderPatches([a, b, c])).toEqual([])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- src/features/admin/utils/reorder.test.ts`
Expected: FAIL — cannot resolve `./reorder`.

- [ ] **Step 3: Write the two functions**

`reorder` is a splice; `sortOrderPatches` renumbers from 1 and returns only the entries whose `sort_order` differs from what the row already holds. The comment explains why the filter matters: a drag near the bottom of a long list should not rewrite every row above it.

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test -- src/features/admin/utils/reorder.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Install dnd-kit and write `SortableList`**

Run: `npm install @dnd-kit/core@6.3.1 @dnd-kit/sortable@10.0.0`

`SortableList` wraps `DndContext` + `SortableContext` with **three sensors enabled — pointer, touch and keyboard**. The panel is used on a phone, and ▲/▼ at least worked everywhere; a drag that only works with a mouse is a regression dressed as a feature.

`renderItem` receives the item and the props for the handle, so the handle is placed by the caller — on the left, per the request — and the rest of the row stays clickable. The handle is a grip icon drawn inline as SVG with `stroke="currentColor"`, `aria-label="Riordina"`, and `cursor-grab` / `active:cursor-grabbing`.

The component calls `onReorder(nextItems)` and never writes.

- [ ] **Step 6: Wire it into `FieldsPage` and `useAdminFields`**

Remove `moveField` and the ▲/▼ buttons entirely. `useAdminFields` gains `reorderFields(patches)` that writes the rows `sortOrderPatches` returned, each proving it wrote — the same rule as every other mutation on this branch.

On any failure: invalidate and refetch so the list shows the order the database actually holds, and show the failure. Spec §2.5 is explicit — a wrong order the manager can see and redo is recoverable, one the screen hides is not. Do **not** keep an optimistic order on screen after a failed write.

- [ ] **Step 7: Verify and commit**

Run: `npx tsc -b && npm run test && npm run lint && npm run build`
Expected: PASS, 176 tests (170 + 6).

In the browser: drag a pitch with the mouse, then with the keyboard (Tab to the handle, Space, arrows, Space), then with touch emulation. Reload after each and confirm the order stuck.

```bash
git add package.json package-lock.json src/shared/components/ui/SortableList.tsx \
        src/features/admin/utils/reorder.ts src/features/admin/utils/reorder.test.ts \
        src/features/admin/components/FieldsPage.tsx src/features/admin/hooks/useAdminFields.ts
git commit -m "feat(admin): drag a pitch into place, with a finger or a keyboard"
```

---

### Task 7: The phone, the bundle, and the guide

Spec §6 and §7. The two risks this plan took, checked rather than assumed.

**Files:**
- Modify: `docs/come-provare.md` — a phone scenario for the new controls
- Modify: `docs/superpowers/specs/2026-09-11-ui-primitives-design.md` — record the measured bundle cost

**Interfaces:** none.

- [ ] **Step 1: Measure what the dependencies cost**

Run: `npm run build`

The spec's budget is the current precache total, **630.41 KiB**, recorded when the PWA was built before this work. Record the new figure and the difference. A rise of more than about 15% is a finding worth reporting rather than filing quietly — say the number either way.

- [ ] **Step 2: Try all three controls on a real phone**

Start the LAN server — `npm run dev:phone`, which serves on port 5175 and points at the machine's network address — and open `/admin` from a phone on the same Wi-Fi. The manager is `347 220 15 63`, code `472839`.

Check the three things the spec says decide whether this work succeeded:
- pick a date from `DateField` with a thumb. Compare it honestly against what the native wheel used to do. If ours is worse, say so — spec §2.4 makes that the bar, and a plausible-looking calendar that is fiddly on glass is the failure mode this step exists to catch;
- pick a time from `TimeField` — 97 options in a scrolling list is where a select gets unpleasant on a small screen;
- drag a pitch into a new position with a finger.

- [ ] **Step 3: Write the scenario into the guide**

Add a scenario 12 to `docs/come-provare.md` in that file's voice — what to do, and what you must see — covering the three checks above from a phone. Keep the existing scenarios untouched.

- [ ] **Step 4: Commit**

```bash
git add docs/come-provare.md docs/superpowers/specs/2026-09-11-ui-primitives-design.md
git commit -m "docs: what the new controls must survive on a phone, and what they cost"
```

---

## Done when

- The panel's selects, dates and times are ours: welded dropdowns, the club's colour on the highlight, a pointer over the options, and a column of fields whose text starts at the same x.
- A band can close at midnight from a control that offers midnight; a closure dialog holds two instants without scrolling sideways.
- A pitch is dragged into place with a mouse, a finger or a keyboard, and the list never shows an order the database does not hold.
- The toast can be dismissed and sits where it blocks nothing.
- `npm run test` (176), `npm run test:db` (82), `npx tsc -b`, `npm run lint` and `npm run build` all clean, and the bundle's growth is a number someone wrote down.

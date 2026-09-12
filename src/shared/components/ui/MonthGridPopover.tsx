import * as Popover from '@radix-ui/react-popover'
import { addMonths, format, isSameDay, isSameMonth, isToday, subMonths } from 'date-fns'
import { it } from 'date-fns/locale'
import { useContext, useEffect, useRef, useState, type JSX, type KeyboardEvent, type ReactNode } from 'react'
import { DialogPortalContext } from './Dialog'
import { monthGrid } from './monthGrid'

const WEEKS = 6
const DAYS_PER_WEEK = 7

/**
 * The calendar popover both `DateField` and `DateJump` open — a month, from
 * a `Popover.Trigger` the caller supplies, picked with the same
 * keyboard-navigable six-week grid either way. `DateField` binds a value a
 * form reads back; `DateJump` has none of its own — it is a one-shot jump
 * to a day, not a bound field — so `value` here is nullable, and only
 * affects which day opens highlighted/focused and which one the grid marks
 * `aria-selected`, never what the trigger itself shows: that display is the
 * trigger's own business, not this component's.
 *
 * `isDayDisabled` is supplied rather than a `min`/`max` pair here, because
 * `DateField` reads `Date` bounds and `DateJump` reads `'yyyy-MM-dd'`
 * strings — the comparison itself is the one piece each caller still owns.
 *
 * Every day cell stays a real, native-`disabled` `<button>` when it's out
 * of range — never focusable, per the platform's own contract for
 * `disabled` — so the roving tabindex (`focusIndexFor`, `handleGridKeyDown`)
 * is careful to never point at one: a disabled cell holding the only
 * `tabIndex={0}` in the grid would leave the whole calendar unreachable by
 * keyboard, with nothing announcing the failure.
 */
export function MonthGridPopover({ value, isDayDisabled, onSelectDay, trigger }: {
  value: Date | null
  isDayDisabled: (day: Date) => boolean
  onSelectDay: (day: Date) => void
  trigger: ReactNode
}): JSX.Element {
  const dialogContainer = useContext(DialogPortalContext)

  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => value ?? new Date())
  // -1 means no day in the 42-cell grid is pickable — `isDayDisabled` blocks
  // the whole visible month. See `focusRovingTarget`.
  const [focusIndex, setFocusIndex] = useState(0)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  const nextMonthButtonRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)

  const grid = monthGrid(month)
  const weeks: Date[][] = []
  for (let w = 0; w < WEEKS; w++) {
    weeks.push(grid.slice(w * DAYS_PER_WEEK, w * DAYS_PER_WEEK + DAYS_PER_WEEK))
  }

  // Where the roving cell should land: the selected day if it is itself
  // pickable, else today if today is pickable and falls in the shown month
  // (a picker opened with nothing chosen should land where the user is, not
  // on the 1st for no reason), else the first pickable day of the shown
  // month, else the first pickable day anywhere in the 42-day grid. Never a
  // disabled day — a native `disabled` button refuses `.focus()` outright,
  // and with every other cell at `tabIndex={-1}` that would leave nothing in
  // the grid the keyboard can reach. Returns -1 when the whole grid is
  // blocked.
  function focusIndexFor(base: Date, g: Date[]): number {
    if (value) {
      const idx = g.findIndex((d) => isSameDay(d, value) && !isDayDisabled(d))
      if (idx !== -1) return idx
    }
    const todayIdx = g.findIndex((d) => isToday(d) && isSameMonth(d, base) && !isDayDisabled(d))
    if (todayIdx !== -1) return todayIdx
    const inMonthIdx = g.findIndex((d) => isSameMonth(d, base) && !isDayDisabled(d))
    if (inMonthIdx !== -1) return inMonthIdx
    return g.findIndex((d) => !isDayDisabled(d))
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      const base = value ?? new Date()
      setMonth(base)
      setFocusIndex(focusIndexFor(base, monthGrid(base)))
    }
    setOpen(next)
  }

  function goToMonth(next: Date) {
    setMonth(next)
    setFocusIndex(focusIndexFor(next, monthGrid(next)))
  }

  // Puts focus on the current roving target: a day cell, or — when
  // `isDayDisabled` leaves nothing in the visible month pickable
  // (`focusIndex === -1`) — the "next month" button, so the popover is
  // never left with nothing the keyboard can reach.
  function focusRovingTarget() {
    if (focusIndex === -1) nextMonthButtonRef.current?.focus()
    else cellRefs.current[focusIndex]?.focus()
  }

  // Keeps keyboard focus following the roving cell after the visible month
  // changes *while the popover is already open* — the ‹ › buttons, or an
  // arrow key crossing a month boundary. The open transition itself is
  // handled by `onOpenAutoFocus` on `Popover.Content` below, not here:
  // relying on a passive effect for that too only worked by accident of
  // React running children's passive effects before Radix's own FocusScope
  // autofocus effect, an implementation detail of Radix, not a contract it
  // published. `wasOpenRef` tells the two moments apart, so this effect does
  // nothing on the render where `open` itself just flipped true.
  useEffect(() => {
    const wasOpen = wasOpenRef.current
    wasOpenRef.current = open
    if (!open || !wasOpen) return
    focusRovingTarget()
  }, [month, focusIndex, open])

  function selectDay(day: Date) {
    if (isDayDisabled(day)) return
    onSelectDay(day)
    setOpen(false)
  }

  function handleGridKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    let delta = 0
    switch (e.key) {
      case 'ArrowRight': delta = 1; break
      case 'ArrowLeft': delta = -1; break
      case 'ArrowDown': delta = DAYS_PER_WEEK; break
      case 'ArrowUp': delta = -DAYS_PER_WEEK; break
      default: return
    }
    e.preventDefault()
    // Step past disabled days in the direction of travel — the same reason
    // `focusIndexFor` never lands on one: arrowing onto a disabled cell
    // would try to focus a button that refuses it, silently killing keyboard
    // navigation one step earlier than the open/month-change cases above.
    let next = focusIndex + delta
    while (next >= 0 && next < WEEKS * DAYS_PER_WEEK && isDayDisabled(grid[next])) {
      next += delta
    }
    if (next < 0) {
      goToMonth(subMonths(month, 1))
      return
    }
    if (next >= WEEKS * DAYS_PER_WEEK) {
      goToMonth(addMonths(month, 1))
      return
    }
    setFocusIndex(next)
    cellRefs.current[next]?.focus()
  }

  function cellClassName(day: Date): string {
    const selected = value ? isSameDay(day, value) : false
    const today = isToday(day)
    const inMonth = isSameMonth(day, month)
    const disabled = isDayDisabled(day)
    const classes = [
      // 2.75rem = 44px, the tab bar's own floor — nothing here depends on
      // hover. The focus ring is set with the `outline` shorthand as an
      // arbitrary value, not Tailwind's `outline-*` utilities: those all
      // read a single shared `--tw-outline-style` variable, and both
      // `outline-none` and `outline-hidden` pin that variable to `none` for
      // the *element*, not just the default state — so a later
      // `focus-visible:outline-*` on the same element stays silently
      // cancelled. Found by actually driving the grid from the keyboard:
      // the roving cell moved correctly (confirmed programmatically) but a
      // sighted keyboard user had no way to see where they were, on any
      // cell that was neither "today" nor selected.
      'grid h-11 w-11 place-items-center rounded-md text-[13.5px] outline-hidden transition-colors focus-visible:[outline:2px_solid_var(--pitch)] focus-visible:[outline-offset:2px]',
    ]
    if (selected) classes.push('bg-pitch text-on-pitch')
    else if (disabled) classes.push('cursor-not-allowed text-muted')
    else if (!inMonth) classes.push('text-muted hover:bg-pitch-tint hover:text-pitch')
    else classes.push('text-ink hover:bg-pitch-tint hover:text-pitch')
    if (today && !selected) classes.push('ring-1 ring-inset ring-pitch')
    return classes.join(' ')
  }

  const weekdayLabels = weeks[0].map((d) => format(d, 'EEEEE', { locale: it }))

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Popover.Portal container={dialogContainer ?? undefined}>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-max rounded-card border border-line bg-surface p-2 text-ink shadow-card"
          onOpenAutoFocus={(e) => {
            // Deterministic, not incidental: take over from Radix's own
            // default (focus the first focusable descendant, which would be
            // the ‹ button) and put focus on the roving target ourselves.
            e.preventDefault()
            focusRovingTarget()
          }}
        >
          <div className="flex items-center justify-between px-1 pb-2">
            <button
              type="button"
              aria-label="Mese precedente"
              onClick={() => goToMonth(subMonths(month, 1))}
              className="grid h-11 w-11 place-items-center rounded-md text-ink-2 hover:bg-pitch-tint hover:text-pitch"
            >
              ‹
            </button>
            <span className="text-[13.5px] font-medium capitalize">
              {format(month, 'MMMM yyyy', { locale: it })}
            </span>
            <button
              type="button"
              ref={nextMonthButtonRef}
              aria-label="Mese successivo"
              onClick={() => goToMonth(addMonths(month, 1))}
              className="grid h-11 w-11 place-items-center rounded-md text-ink-2 hover:bg-pitch-tint hover:text-pitch"
            >
              ›
            </button>
          </div>
          <div
            role="grid"
            aria-label={format(month, 'MMMM yyyy', { locale: it })}
            onKeyDown={handleGridKeyDown}
          >
            <div role="row" className="grid grid-cols-7">
              {weekdayLabels.map((label, i) => (
                <div
                  key={i}
                  role="columnheader"
                  className="grid h-8 place-items-center text-[12px] uppercase text-muted"
                >
                  {label}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div role="row" className="grid grid-cols-7" key={wi}>
                {week.map((day, di) => {
                  const i = wi * DAYS_PER_WEEK + di
                  const selected = value ? isSameDay(day, value) : false
                  return (
                    <div
                      role="gridcell"
                      key={day.toISOString()}
                      aria-selected={selected}
                    >
                      <button
                        type="button"
                        ref={(el) => { cellRefs.current[i] = el }}
                        tabIndex={i === focusIndex ? 0 : -1}
                        disabled={isDayDisabled(day)}
                        aria-current={isToday(day) ? 'date' : undefined}
                        // The full date, not the bare day number this button
                        // shows: a 42-cell grid holds a trailing "1" from next
                        // month and a leading "1" from this one, and a bare
                        // number can't tell a screen-reader user which is
                        // which. This has to sit on the button itself, not
                        // the gridcell around it — DOM focus (and every
                        // `.focus()` call in this file) lands on the button,
                        // and an ancestor's aria-label never folds into a
                        // descendant's own accessible name.
                        aria-label={format(day, 'd MMMM yyyy', { locale: it })}
                        onClick={() => selectDay(day)}
                        onFocus={() => setFocusIndex(i)}
                        className={cellClassName(day)}
                      >
                        {day.getDate()}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}

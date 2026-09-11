import * as Popover from '@radix-ui/react-popover'
import { addMonths, format, isSameMonth, isToday, startOfDay, subMonths } from 'date-fns'
import { it } from 'date-fns/locale'
import { useContext, useEffect, useRef, useState, type JSX, type KeyboardEvent } from 'react'
import { DialogPortalContext } from './Dialog'
import { monthGrid } from './monthGrid'

const WEEKS = 6
const DAYS_PER_WEEK = 7

/**
 * A jump to a date, not a calendar written by hand: an icon button that
 * opens a month grid, the same picking mechanism `DateField` uses — spec
 * §2.4. It is not built *on* `DateField` itself: that component's trigger is
 * a full-width field showing the current value, and this one has no value of
 * its own to show — it is a shortcut to a day, not a bound field — so its
 * trigger stays the small icon button this component always had, and the
 * popover below it is this file's own, sharing only `monthGrid` (pure data)
 * and the `DialogPortalContext` mechanism with `DateField`.
 *
 * `min`/`max` stay `'yyyy-MM-dd'` strings, the shape both call sites already
 * hold (the booking horizon in `DayStrip`, nothing at all in `AdminPage`).
 * They grey days out of the grid, the same discipline `DateField` and
 * `TimeField` apply — see the comment on `DateField`.
 */
export function DateJump({ min, max, onSelect, label }: {
  min?: string   // 'yyyy-MM-dd'
  max?: string   // 'yyyy-MM-dd'
  onSelect: (d: Date) => void
  label: string  // aria-label of the trigger button
}): JSX.Element {
  // Noon, not midnight: an instant at midnight UTC can fall on the previous
  // day in the device's zone, and the bound would slide by one.
  const minDate = min ? startOfDay(new Date(`${min}T12:00:00`)) : undefined
  const maxDate = max ? startOfDay(new Date(`${max}T12:00:00`)) : undefined

  const dialogContainer = useContext(DialogPortalContext)

  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => new Date())
  // -1 means no day in the 42-cell grid is pickable — min/max block the
  // whole visible month. See `focusRovingTarget`.
  const [focusIndex, setFocusIndex] = useState(0)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])
  const nextMonthButtonRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)

  const grid = monthGrid(month)
  const weeks: Date[][] = []
  for (let w = 0; w < WEEKS; w++) {
    weeks.push(grid.slice(w * DAYS_PER_WEEK, w * DAYS_PER_WEEK + DAYS_PER_WEEK))
  }

  function isDayDisabled(day: Date): boolean {
    if (minDate && startOfDay(day) < minDate) return true
    if (maxDate && startOfDay(day) > maxDate) return true
    return false
  }

  // Where the roving cell should land when the popover opens: today, if
  // today is pickable and falls in the shown month, else the first pickable
  // day of the shown month, else the first pickable day anywhere in the
  // 42-day grid. Never a disabled day — a native `disabled` button refuses
  // `.focus()`, and with every other cell at `tabIndex={-1}` that would leave
  // nothing in the grid the keyboard can reach. Returns -1 when the whole
  // grid is blocked — the same edge case `DateField` guards.
  function focusIndexFor(base: Date, g: Date[]): number {
    const todayIdx = g.findIndex((d) => isToday(d) && isSameMonth(d, base) && !isDayDisabled(d))
    if (todayIdx !== -1) return todayIdx
    const inMonthIdx = g.findIndex((d) => isSameMonth(d, base) && !isDayDisabled(d))
    if (inMonthIdx !== -1) return inMonthIdx
    return g.findIndex((d) => !isDayDisabled(d))
  }

  function handleOpenChange(next: boolean) {
    if (next) {
      const base = new Date()
      setMonth(base)
      setFocusIndex(focusIndexFor(base, monthGrid(base)))
    }
    setOpen(next)
  }

  function goToMonth(next: Date) {
    setMonth(next)
    setFocusIndex(focusIndexFor(next, monthGrid(next)))
  }

  // Puts focus on the current roving target: a day cell, or — when min/max
  // leave nothing in the visible month pickable — the "next month" button,
  // so the popover is never left with nothing the keyboard can reach.
  function focusRovingTarget() {
    if (focusIndex === -1) nextMonthButtonRef.current?.focus()
    else cellRefs.current[focusIndex]?.focus()
  }

  // Keeps keyboard focus following the roving cell after the visible month
  // changes *while the popover is already open* — see the identical comment
  // on `DateField`, which this mirrors: the open transition itself is
  // handled by `onOpenAutoFocus` below, not here.
  useEffect(() => {
    const wasOpen = wasOpenRef.current
    wasOpenRef.current = open
    if (!open || !wasOpen) return
    focusRovingTarget()
  }, [month, focusIndex, open])

  function selectDay(day: Date) {
    if (isDayDisabled(day)) return
    onSelect(day)
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
    // `focusIndexFor` never lands on one.
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
    const today = isToday(day)
    const inMonth = isSameMonth(day, month)
    const disabled = isDayDisabled(day)
    const classes = [
      'grid h-11 w-11 place-items-center rounded-md text-[13.5px] outline-hidden transition-colors focus-visible:[outline:2px_solid_var(--pitch)] focus-visible:[outline-offset:2px]',
    ]
    if (disabled) classes.push('cursor-not-allowed text-muted')
    else if (!inMonth) classes.push('text-muted hover:bg-pitch-tint hover:text-pitch')
    else classes.push('text-ink hover:bg-pitch-tint hover:text-pitch')
    if (today) classes.push('ring-1 ring-inset ring-pitch')
    return classes.join(' ')
  }

  const weekdayLabels = weeks[0].map((d) => format(d, 'EEEEE', { locale: it }))

  return (
    <Popover.Root open={open} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <button
          type="button"
          title="Scegli una data"
          aria-label={label}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-surface text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="3" y="5" width="18" height="16" rx="2.5" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
        </button>
      </Popover.Trigger>
      <Popover.Portal container={dialogContainer ?? undefined}>
        <Popover.Content
          align="start"
          sideOffset={4}
          className="z-50 w-max rounded-card border border-line bg-surface p-2 text-ink shadow-card"
          onOpenAutoFocus={(e) => {
            // Deterministic, not incidental: take over from Radix's own
            // default (focus the first focusable descendant, the ‹ button)
            // and put focus on the roving target ourselves.
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
              {weekdayLabels.map((wlabel, i) => (
                <div
                  key={i}
                  role="columnheader"
                  className="grid h-8 place-items-center text-[12px] uppercase text-muted"
                >
                  {wlabel}
                </div>
              ))}
            </div>
            {weeks.map((week, wi) => (
              <div role="row" className="grid grid-cols-7" key={wi}>
                {week.map((day, di) => {
                  const i = wi * DAYS_PER_WEEK + di
                  return (
                    <div role="gridcell" key={day.toISOString()}>
                      <button
                        type="button"
                        ref={(el) => { cellRefs.current[i] = el }}
                        tabIndex={i === focusIndex ? 0 : -1}
                        disabled={isDayDisabled(day)}
                        aria-current={isToday(day) ? 'date' : undefined}
                        // The full date, not the bare day number this button
                        // shows — see the identical comment on `DateField`.
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

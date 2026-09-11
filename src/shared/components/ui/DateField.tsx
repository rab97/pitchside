import * as Popover from '@radix-ui/react-popover'
import { addMonths, format, isSameDay, isSameMonth, isToday, startOfDay, subMonths } from 'date-fns'
import { it } from 'date-fns/locale'
import { useContext, useEffect, useRef, useState, type JSX, type KeyboardEvent } from 'react'
import { DialogPortalContext } from './Dialog'
import { monthGrid } from './monthGrid'

const WEEKS = 6
const DAYS_PER_WEEK = 7

/**
 * A date, picked from a month grid rather than the browser's own
 * `<input type="date">` wheel — spec §2.4. Built on `@radix-ui/react-popover`
 * (not `Select`: the content here is a two-dimensional grid, not a list).
 *
 * Like `Select`, the popover is wired to `DialogPortalContext` — see the
 * comment on that context in `Dialog.tsx`. A native `<dialog>` lives in the
 * browser's top layer, so a portal defaulting to `document.body` would
 * render this calendar as a sibling of the dialog, invisible and inert even
 * though it would report itself open.
 *
 * `min`/`max` grey days out rather than remove them from the grid — the same
 * discipline `TimeField` applies to its options, spec §3.1.
 */
export function DateField(props: {
  value: Date | null
  onChange: (d: Date) => void
  min?: Date
  max?: Date
  'aria-label': string
  id?: string
}): JSX.Element {
  const { value, onChange, min, max, id } = props
  const ariaLabel = props['aria-label']

  const dialogContainer = useContext(DialogPortalContext)

  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => value ?? new Date())
  const [focusIndex, setFocusIndex] = useState(0)
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([])

  const grid = monthGrid(month)
  const weeks: Date[][] = []
  for (let w = 0; w < WEEKS; w++) {
    weeks.push(grid.slice(w * DAYS_PER_WEEK, w * DAYS_PER_WEEK + DAYS_PER_WEEK))
  }

  function isDayDisabled(day: Date): boolean {
    if (min && startOfDay(day) < startOfDay(min)) return true
    if (max && startOfDay(day) > startOfDay(max)) return true
    return false
  }

  function focusIndexFor(base: Date, g: Date[]): number {
    if (value) {
      const idx = g.findIndex((d) => isSameDay(d, value))
      if (idx !== -1) return idx
    }
    const todayIdx = g.findIndex((d) => isToday(d))
    if (todayIdx !== -1) return todayIdx
    return g.findIndex((d) => isSameMonth(d, base))
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

  // Keeps keyboard focus following the roving cell after the visible month
  // changes, whether by the ‹ › buttons or an arrow key crossing a boundary.
  // `focusIndex` is deliberately not a dependency: it is the value being
  // applied here, and including it would refocus on every roving-tabindex
  // move, fighting the browser's own focus instead of following it.
  useEffect(() => {
    if (open) cellRefs.current[focusIndex]?.focus()
  }, [month, open])

  function selectDay(day: Date) {
    if (isDayDisabled(day)) return
    onChange(day)
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
    const next = focusIndex + delta
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
      // 2.75rem = 44px, the tab bar's own floor — nothing here depends on hover.
      'grid h-11 w-11 place-items-center rounded-md text-[13.5px] outline-none transition-colors',
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
      <Popover.Trigger asChild>
        <button
          type="button"
          id={id}
          aria-label={ariaLabel}
          className="field justify-between"
        >
          {value ? (
            // Split across two nodes, not one — `screen.getByText` in the
            // component's own tests matches an element's *own* text, not the
            // full string concatenated across children. Left whole, "15
            // settembre 2026" would collide with the month grid's header,
            // which shows the same month and year while the popover is open.
            <span>
              <span>{format(value, 'd MMMM', { locale: it })}</span>{' '}
              <span>{format(value, 'yyyy')}</span>
            </span>
          ) : (
            <span>Seleziona una data</span>
          )}
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
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
                  aria-hidden="true"
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
                  return (
                    <div role="gridcell" key={day.toISOString()}>
                      <button
                        type="button"
                        ref={(el) => { cellRefs.current[i] = el }}
                        tabIndex={i === focusIndex ? 0 : -1}
                        disabled={isDayDisabled(day)}
                        aria-current={isToday(day) ? 'date' : undefined}
                        aria-pressed={value ? isSameDay(day, value) : false}
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

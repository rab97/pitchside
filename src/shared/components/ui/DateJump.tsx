import { startOfDay } from 'date-fns'
import type { JSX } from 'react'
import { MonthGridPopover } from './MonthGridPopover'

/**
 * A jump to a date, not a calendar written by hand: an icon button that
 * opens the same `MonthGridPopover` as `DateField` — spec §2.4. It is not
 * built *on* `DateField` itself: that component's trigger is a full-width
 * field showing a bound value, and this one has no value of its own to show
 * — it is a shortcut to a day, not a bound field — so its trigger stays the
 * small icon button this component always had, while the grid, its keyboard
 * navigation and its `Dialog`-portal wiring are the shared implementation.
 *
 * `min`/`max` stay `'yyyy-MM-dd'` strings, the shape both call sites already
 * hold (the booking horizon in `DayStrip`, nothing at all in `AdminPage`).
 * They grey days out of the grid, the same discipline `DateField` and
 * `TimeField` apply.
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

  function isDayDisabled(day: Date): boolean {
    if (minDate && startOfDay(day) < minDate) return true
    if (maxDate && startOfDay(day) > maxDate) return true
    return false
  }

  return (
    <MonthGridPopover
      value={null}
      isDayDisabled={isDayDisabled}
      onSelectDay={onSelect}
      trigger={
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
      }
    />
  )
}

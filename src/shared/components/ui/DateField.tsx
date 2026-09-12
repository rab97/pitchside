import { format, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import type { JSX } from 'react'
import { MonthGridPopover } from './MonthGridPopover'

/**
 * A date, picked from a month grid rather than the browser's own
 * `<input type="date">` wheel — spec §2.4. The grid itself, its keyboard
 * navigation and its portal-into-`Dialog` wiring live in `MonthGridPopover`,
 * shared with `DateJump`; this file owns only what is particular to a bound
 * field — the full-width trigger showing the current value, and reading
 * `min`/`max` as `Date`s.
 *
 * `min`/`max` grey days out rather than remove them from the grid — the same
 * discipline `TimeField` applies to its options, spec §3.1. They are read as
 * days, not instants: `isDayDisabled` compares `startOfDay` on both sides,
 * so whatever time of day a caller hands in is irrelevant.
 *
 * `onChange` reports the chosen day at **noon in the device's own zone**,
 * which is how `monthGrid` builds every cell. Not noon Rome: the value
 * stands for a day and never for an instant, and noon is only the widest
 * margin on either side of it — a bare day held at midnight can fall into
 * the day before as soon as a conversion touches it. The callers that do
 * need an instant (`NewClosureDialog` pairing this with a `TimeField`) build
 * it themselves in `Europe/Rome`; see `src/shared/lib/tz.ts`.
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

  function isDayDisabled(day: Date): boolean {
    if (min && startOfDay(day) < startOfDay(min)) return true
    if (max && startOfDay(day) > startOfDay(max)) return true
    return false
  }

  return (
    <MonthGridPopover
      value={value}
      isDayDisabled={isDayDisabled}
      onSelectDay={onChange}
      trigger={
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
      }
    />
  )
}

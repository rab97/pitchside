import type { JSX } from 'react'
import { minToLabel } from '@/shared/lib/tz'
import { Select, type SelectOption } from './Select'

/**
 * A time of day, picked from a `Select` list that always covers the whole
 * day at `step`-minute intervals, `0` to `1440` inclusive — midnight to
 * midnight-as-closing, both ends nameable, which the browser's own
 * `<input type="time">` cannot offer for `24:00`.
 *
 * `min`/`max` never shrink that list. Spec §3.1: a greyed option says "this
 * exists and you cannot have it now"; a missing one says nothing, and leaves
 * the manager wondering whether they looked properly. So out-of-range
 * minutes stay in the list and are marked `disabled` — `Select` already
 * carries that per option and styles it `data-[disabled]:text-muted`, so
 * this is a flag on data we already had, not new machinery.
 *
 * `value` is nullable: a time field starts with nothing chosen has no
 * legitimate default — `0` would be `00:00`, a real, submittable instant,
 * not a prompt to pick one — so callers that begin unset (a new closure, a
 * new price band) pass `null` and show «--:--» until the manager actually
 * chooses. Editing an existing record still prefills the real value.
 *
 * `TimeField` converts at its own edge: callers hand it and get back a
 * minute count, never a label.
 */
export function TimeField(props: {
  value: number | null // minutes from midnight; null = nothing chosen yet
  onChange: (min: number) => void
  min?: number // default 0 — below it, options are DISABLED, not removed
  max?: number // default 1440 — above it, likewise
  step?: number // default 15
  'aria-label': string
  id?: string
}): JSX.Element {
  const { value, onChange, min = 0, max = 1440, step = 15, id } = props

  const options: SelectOption<string>[] = []
  for (let m = 0; m <= 1440; m += step) {
    options.push({ value: String(m), label: minToLabel(m), disabled: m < min || m > max })
  }
  // `step` need not divide 1440 evenly — the last multiple can land short of
  // midnight. `0..1440 inclusive` is a hard requirement, so midnight-as-
  // closing is appended whenever the loop above did not already land on it.
  if (options[options.length - 1]?.value !== '1440') {
    options.push({ value: '1440', label: minToLabel(1440), disabled: 1440 < min || 1440 > max })
  }

  return (
    <Select
      value={value == null ? '' : String(value)}
      onChange={(v) => onChange(Number(v))}
      options={options}
      placeholder="--:--"
      aria-label={props['aria-label']}
      id={id}
    />
  )
}

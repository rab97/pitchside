import { addDays, startOfMonth, startOfWeek } from 'date-fns'

/**
 * The 42 days a month popover shows: always six whole weeks, Monday-first,
 * each day fixed at noon in the device's own local time.
 *
 * Six weeks — not the four or five a given month actually spans — because a
 * fixed cell count keeps the popover the same height every time the month
 * changes; a grid that grows and shrinks with the calendar is what makes a
 * date picker feel like it jumps under the finger.
 *
 * Noon, not midnight, for the reason every bare day in this app is held at
 * noon — `DateJump`'s `min`/`max` bounds, `RecurrenceForm`'s «fino al»: a
 * day held at midnight can slide into the day before once a timezone
 * conversion touches it. Noon leaves no room on either side. (`DateJump`
 * used to read a native `<input type="date">` at noon for this; it has no
 * native input any more — it is a caller of this file.)
 */
export function monthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(start, i)
    day.setHours(12, 0, 0, 0)
    return day
  })
}

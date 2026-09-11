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
 * Noon, not midnight, for the same reason `DateJump` reads its native input
 * at noon: a day held at midnight can slide into the day before once a
 * timezone conversion touches it. Noon leaves no room on either side.
 */
export function monthGrid(month: Date): Date[] {
  const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 })
  return Array.from({ length: 42 }, (_, i) => {
    const day = addDays(start, i)
    day.setHours(12, 0, 0, 0)
    return day
  })
}

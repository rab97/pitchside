import { minToLabel } from '@/shared/lib/tz'
import type { Band } from './daySegments'

// Duplicated on purpose, the way `RecurrenceForm`'s own `WEEKDAY` already is:
// one more copy of seven strings is cheaper than a shared import that ties
// this message to that component's index convention (1 lunedì … 7 domenica).
const WEEKDAY_NAME = ['', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']

/**
 * `usePriceBands.saveBand` runs `findOverlappingBand` before deleting
 * anything, precisely so it can say which band and which hours — the
 * generic `23P01` sentence below fires only after the old group is already
 * gone, when there is nothing left to name but "some row collided".
 */
export function messageForBandOverlap(conflict: Band): string {
  return `Questa fascia si sovrappone a ${minToLabel(conflict.startsMin)}–${minToLabel(conflict.endsMin)} `
    + `di ${WEEKDAY_NAME[conflict.weekday]}: correggi gli orari o modifica quella.`
}

/**
 * Thrown by the pre-check, before any row is deleted. Its `message` is
 * already the specific sentence from `messageForBandOverlap`, so
 * `messageForBandWrite` must return it unchanged rather than falling
 * through to the generic wording meant for the database constraint.
 */
export class BandOverlapError extends Error {}

/**
 * The failures this form can actually produce, said in words a manager can
 * act on. `23P01` is `price_bands_no_overlap` firing on a write the
 * pre-check missed — a concurrent edit, most likely — so it still needs a
 * message, just a generic one: the specific band it collided with was
 * already deleted by the time Postgres complained. `23514` is the
 * `ends_min > starts_min` check.
 */
export function messageForBandWrite(error: unknown): string {
  if (error instanceof BandOverlapError) return error.message
  const code = (error as { code?: string } | null)?.code
  if (code === '23P01') {
    return 'Questa fascia si sovrappone a una già impostata: correggi gli orari o modifica quella.'
  }
  if (code === '23514') {
    return 'Gli orari non sono validi: la fine deve venire dopo l’inizio.'
  }
  return 'Non siamo riusciti a salvare la fascia. Riprova.'
}

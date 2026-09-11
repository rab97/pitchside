import type { Band } from './daySegments'

/**
 * Whether writing `[startsMin, endsMin)` on `weekdays` would collide with a
 * band already stored for a different group. `excludeIds` names the rows
 * `saveBand` is about to delete and replace — the group being edited must
 * not be reported as colliding with itself.
 *
 * Half-open like every other range in this codebase: a band ending at 1140
 * does not overlap one starting at 1140. `price_bands_no_overlap` would
 * refuse the same write, but only once the old group is already gone, and
 * it cannot say which band it collided with — this runs first, against the
 * bands already loaded, so the caller can name one before anything is
 * deleted.
 */
export function findOverlappingBand(
  bands: Band[],
  weekdays: number[],
  startsMin: number,
  endsMin: number,
  excludeIds: string[] = [],
): Band | null {
  const excluded = new Set(excludeIds)
  for (const weekday of weekdays) {
    const hit = bands.find((b) =>
      b.weekday === weekday &&
      !excluded.has(b.id) &&
      startsMin < b.endsMin &&
      b.startsMin < endsMin)
    if (hit) return hit
  }
  return null
}

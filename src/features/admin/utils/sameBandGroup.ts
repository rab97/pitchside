import type { Band } from './daySegments'

/**
 * Whether two `price_bands` rows are the same band as the manager means it.
 *
 * A band in the panel is one idea — "lun-ven, 18:00-20:00, 30 €" — and
 * several rows underneath, one per weekday, because `price_bands`
 * deliberately has no column tying them together (facility-configuration
 * spec §2.2). Which rows belong together therefore exists nowhere but here:
 * same hours, same price. `BandDialog` uses it to pre-tick the weekday
 * checkboxes and to pick the rows a delete removes, `usePriceBands` to pick
 * the rows an edit replaces — and the three answers have to agree, or the
 * manager deletes six weekdays and gets five.
 *
 * `weekday` is precisely what it must not compare: the whole point is to
 * gather the rows that differ only in that.
 */
export function sameBandGroup(a: Band, b: Band): boolean {
  return a.startsMin === b.startsMin
    && a.endsMin === b.endsMin
    && a.priceCents === b.priceCents
}

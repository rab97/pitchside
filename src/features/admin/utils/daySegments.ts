const DAY_MIN = 1440

export type Band = {
  id: string
  weekday: number
  startsMin: number
  endsMin: number
  priceCents: number
}

export type Segment =
  | { kind: 'open'; fromMin: number; toMin: number; priceCents: number; bandId: string }
  | { kind: 'closed'; fromMin: number; toMin: number }

/**
 * One weekday of a pitch, from midnight to midnight, with the closed
 * stretches made explicit instead of left as holes.
 *
 * Price bands *are* the opening hours: a minute no band covers is a minute
 * `calc_booking_price` refuses with PS005. That rule is invisible in a table
 * of rows and obvious in a timeline, which is why this function returns the
 * closed stretches as segments of their own rather than expecting the caller
 * to notice the gaps between bands.
 *
 * Two touching bands stay two segments even at the same price: they are two
 * rows a manager edits separately, and merging them would hide the seam.
 * Overlaps cannot occur — `price_bands_no_overlap` forbids them in the
 * database — so the sort is enough to walk the day in order.
 */
export function daySegments(bands: Band[], weekday: number): Segment[] {
  const day = bands
    .filter((b) => b.weekday === weekday)
    .sort((a, b) => a.startsMin - b.startsMin)

  const out: Segment[] = []
  let cursor = 0

  for (const b of day) {
    if (b.startsMin > cursor) {
      out.push({ kind: 'closed', fromMin: cursor, toMin: b.startsMin })
    }
    out.push({
      kind: 'open',
      fromMin: b.startsMin,
      toMin: b.endsMin,
      priceCents: b.priceCents,
      bandId: b.id,
    })
    cursor = b.endsMin
  }

  if (cursor < DAY_MIN) {
    out.push({ kind: 'closed', fromMin: cursor, toMin: DAY_MIN })
  }

  return out
}

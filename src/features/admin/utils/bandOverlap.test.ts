import { describe, expect, it } from 'vitest'
import { findOverlappingBand } from './bandOverlap'
import type { Band } from './daySegments'

const band = (over: Partial<Band> = {}): Band => ({
  id: 'existing', weekday: 1, startsMin: 540, endsMin: 1140, priceCents: 2000, ...over,
})

describe('findOverlappingBand', () => {
  it('finds nothing against an empty week', () => {
    expect(findOverlappingBand([], [1], 540, 600)).toBeNull()
  })

  it('a new band with no group to exclude is checked against everything', () => {
    const existing = band()
    expect(findOverlappingBand([existing], [1], 600, 660)).toBe(existing)
  })

  it('does not overlap a band it only touches — half-open at both ends', () => {
    const existing = band({ startsMin: 540, endsMin: 1140 })
    // starts exactly where the existing band ends
    expect(findOverlappingBand([existing], [1], 1140, 1200)).toBeNull()
    // ends exactly where the existing band starts
    expect(findOverlappingBand([existing], [1], 300, 540)).toBeNull()
  })

  it('reports a partial overlap on either edge', () => {
    const existing = band({ startsMin: 540, endsMin: 1140 })
    expect(findOverlappingBand([existing], [1], 500, 600)).toBe(existing)
    expect(findOverlappingBand([existing], [1], 1100, 1200)).toBe(existing)
  })

  it('reports a range that fully contains, or sits fully inside, an existing band', () => {
    const existing = band({ startsMin: 540, endsMin: 1140 })
    expect(findOverlappingBand([existing], [1], 0, 1440)).toBe(existing)
    expect(findOverlappingBand([existing], [1], 600, 700)).toBe(existing)
  })

  it('ignores a band on a weekday nobody ticked', () => {
    const existing = band({ weekday: 2 })
    expect(findOverlappingBand([existing], [1], 0, 1440)).toBeNull()
  })

  it('excludes the group being replaced from the check', () => {
    const own = band({ id: 'own' })
    // Editing the same band to the same hours must not collide with itself.
    expect(findOverlappingBand([own], [1], 540, 1140, ['own'])).toBeNull()
  })

  it('an edit still collides with a different band on a weekday it keeps', () => {
    const own = band({ id: 'own', weekday: 1 })
    const other = band({ id: 'other', weekday: 3, startsMin: 600, endsMin: 700 })
    expect(findOverlappingBand([own, other], [1, 3], 540, 1140, ['own'])).toBe(other)
  })

  it('an edit that adds a weekday can collide even though the dropped weekday would not have', () => {
    // The group being edited used to cover Monday and Tuesday; the edit
    // drops Tuesday and adds Wednesday, where a different band already sits.
    const own = band({ id: 'own', weekday: 1 })
    const clash = band({ id: 'clash', weekday: 3, startsMin: 600, endsMin: 700 })
    expect(findOverlappingBand([own, clash], [1, 3], 540, 1140, ['own'])).toBe(clash)
    // Tuesday, which the edit no longer ticks, is never even inspected.
    expect(findOverlappingBand([own], [1], 540, 1140, ['own'])).toBeNull()
  })
})

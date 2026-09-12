import { describe, expect, it } from 'vitest'
import { sameBandGroup } from './sameBandGroup'
import type { Band } from './daySegments'

function band(patch: Partial<Band> = {}): Band {
  return {
    id: 'b1', weekday: 1, startsMin: 18 * 60, endsMin: 20 * 60, priceCents: 3000,
    ...patch,
  }
}

describe('sameBandGroup', () => {
  it('groups rows that differ only by weekday', () => {
    expect(sameBandGroup(band({ id: 'b1', weekday: 1 }), band({ id: 'b2', weekday: 5 })))
      .toBe(true)
  })

  it('separates a different start, a different end and a different price', () => {
    const reference = band()
    expect(sameBandGroup(reference, band({ startsMin: 17 * 60 }))).toBe(false)
    expect(sameBandGroup(reference, band({ endsMin: 21 * 60 }))).toBe(false)
    expect(sameBandGroup(reference, band({ priceCents: 3500 }))).toBe(false)
  })

  // The failure this definition exists to prevent: a band edited or deleted
  // must take its whole week with it. Filtering a real list is how all three
  // call sites use it, so that is what is checked here.
  it('picks the whole group out of a pitch’s bands and nothing else', () => {
    const bands: Band[] = [
      band({ id: 'mon', weekday: 1 }),
      band({ id: 'tue', weekday: 2 }),
      band({ id: 'wed-cheaper', weekday: 3, priceCents: 2500 }),
      band({ id: 'thu-later', weekday: 4, startsMin: 20 * 60, endsMin: 22 * 60 }),
      band({ id: 'fri', weekday: 5 }),
    ]

    expect(bands.filter((b) => sameBandGroup(b, band())).map((b) => b.id))
      .toEqual(['mon', 'tue', 'fri'])
  })
})

import { describe, expect, it } from 'vitest'
import { daySegments, type Band } from './daySegments'

const band = (over: Partial<Band> = {}): Band => ({
  id: 'b1', weekday: 1, startsMin: 540, endsMin: 1140, priceCents: 2000, ...over,
})

describe('daySegments', () => {
  it('a day with no bands is closed from midnight to midnight', () => {
    expect(daySegments([], 1)).toEqual([{ kind: 'closed', fromMin: 0, toMin: 1440 }])
  })

  it('surrounds a band with the closed stretches around it', () => {
    expect(daySegments([band()], 1)).toEqual([
      { kind: 'closed', fromMin: 0, toMin: 540 },
      { kind: 'open', fromMin: 540, toMin: 1140, priceCents: 2000, bandId: 'b1' },
      { kind: 'closed', fromMin: 1140, toMin: 1440 },
    ])
  })

  it('ignores the bands of other weekdays', () => {
    const other = band({ id: 'b2', weekday: 2, startsMin: 0, endsMin: 1440 })
    expect(daySegments([band(), other], 1)).toEqual([
      { kind: 'closed', fromMin: 0, toMin: 540 },
      { kind: 'open', fromMin: 540, toMin: 1140, priceCents: 2000, bandId: 'b1' },
      { kind: 'closed', fromMin: 1140, toMin: 1440 },
    ])
  })

  it('a band covering the whole day leaves no closed stretch', () => {
    const all = band({ startsMin: 0, endsMin: 1440 })
    expect(daySegments([all], 1)).toEqual([
      { kind: 'open', fromMin: 0, toMin: 1440, priceCents: 2000, bandId: 'b1' },
    ])
  })

  it('keeps two touching bands apart even at the same price', () => {
    // They are two rows, two prices a manager can change independently, and
    // drawing them as one would hide the seam where an edit lands.
    const a = band({ id: 'a', startsMin: 540, endsMin: 1140 })
    const b = band({ id: 'b', startsMin: 1140, endsMin: 1440 })
    expect(daySegments([a, b], 1)).toEqual([
      { kind: 'closed', fromMin: 0, toMin: 540 },
      { kind: 'open', fromMin: 540, toMin: 1140, priceCents: 2000, bandId: 'a' },
      { kind: 'open', fromMin: 1140, toMin: 1440, priceCents: 2000, bandId: 'b' },
    ])
  })

  it('shows the gap between two bands that do not touch', () => {
    const morning = band({ id: 'a', startsMin: 540, endsMin: 720 })
    const evening = band({ id: 'b', startsMin: 1080, endsMin: 1440 })
    expect(daySegments([evening, morning], 1)).toEqual([
      { kind: 'closed', fromMin: 0, toMin: 540 },
      { kind: 'open', fromMin: 540, toMin: 720, priceCents: 2000, bandId: 'a' },
      { kind: 'closed', fromMin: 720, toMin: 1080 },
      { kind: 'open', fromMin: 1080, toMin: 1440, priceCents: 2000, bandId: 'b' },
    ])
  })
})

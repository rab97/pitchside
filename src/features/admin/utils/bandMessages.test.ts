import { describe, expect, it } from 'vitest'
import { BandOverlapError, messageForBandOverlap, messageForBandWrite } from './bandMessages'
import type { Band } from './daySegments'

const band = (over: Partial<Band> = {}): Band => ({
  id: 'b1', weekday: 1, startsMin: 540, endsMin: 1140, priceCents: 2000, ...over,
})

describe('messageForBandOverlap', () => {
  it('names the conflicting band, its hours and its weekday', () => {
    expect(messageForBandOverlap(band({ weekday: 1, startsMin: 1140, endsMin: 1440 })))
      .toBe('Questa fascia si sovrappone a 19:00–24:00 di lunedì: correggi gli orari o modifica quella.')
  })

  it('names a different weekday', () => {
    expect(messageForBandOverlap(band({ weekday: 7, startsMin: 0, endsMin: 60 })))
      .toBe('Questa fascia si sovrappone a 00:00–01:00 di domenica: correggi gli orari o modifica quella.')
  })
})

describe('messageForBandWrite', () => {
  it('passes through the pre-check’s specific message unchanged', () => {
    const specific = messageForBandOverlap(band({ weekday: 1, startsMin: 1140, endsMin: 1440 }))
    expect(messageForBandWrite(new BandOverlapError(specific))).toBe(specific)
  })

  it('names the overlap for what it is', () => {
    // 23P01 is the exclusion violation from price_bands_no_overlap.
    expect(messageForBandWrite({ code: '23P01' }))
      .toBe('Questa fascia si sovrappone a una già impostata: correggi gli orari o modifica quella.')
  })

  it('explains an impossible time range', () => {
    expect(messageForBandWrite({ code: '23514' }))
      .toBe('Gli orari non sono validi: la fine deve venire dopo l’inizio.')
  })

  it('falls back without inventing a cause', () => {
    expect(messageForBandWrite({ code: 'XX000' }))
      .toBe('Non siamo riusciti a salvare la fascia. Riprova.')
  })
})

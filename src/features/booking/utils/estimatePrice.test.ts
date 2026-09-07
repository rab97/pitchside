import { describe, expect, it } from 'vitest'
import { estimatePrice, type PriceBand } from './estimatePrice'

// feriale: 15:00–19:00 a 20 €/h, 19:00–24:00 a 25 €/h; weekend: 09:00–24:00 a 28 €/h
// stesse fasce di supabase/tests/003_price.test.sql, stessi casi.
const bands: PriceBand[] = [
  { weekdays: [1, 2, 3, 4, 5], starts_min: 900, ends_min: 1140, price_cents: 2000 },
  { weekdays: [1, 2, 3, 4, 5], starts_min: 1140, ends_min: 1440, price_cents: 2500 },
  { weekdays: [6, 7], starts_min: 540, ends_min: 1440, price_cents: 2800 },
]

describe('estimatePrice', () => {
  it('una sola fascia: 1h30 alle 20:00 di martedì fa 37,50 euro', () => {
    expect(estimatePrice(bands, 2, 1200, 90)).toBe(3750)
  })

  it('a cavallo di due fasce: 18:00–20:00 di martedì fa 45,00 euro', () => {
    expect(estimatePrice(bands, 2, 1080, 120)).toBe(4500)
  })

  it('fascia del weekend: 10:00–11:00 di sabato fa 28,00 euro', () => {
    expect(estimatePrice(bands, 6, 600, 60)).toBe(2800)
  })

  it('fuori da ogni fascia non c’è stima onesta da mostrare', () => {
    expect(estimatePrice(bands, 2, 0, 60)).toBeNull()
  })
})

import { describe, expect, it } from 'vitest'
import { slotRange } from './tz'

// Il giorno è una stringa 'yyyy-MM-dd', non una Date: così il risultato non
// dipende dal fuso della macchina che esegue i test.
describe('slotRange', () => {
  it('costruisce un intervallo Postgres semiaperto', () => {
    expect(slotRange('2025-10-14', 20 * 60, 90))
      .toBe('["2025-10-14T18:00:00.000Z","2025-10-14T19:30:00.000Z")')
  })

  it('regge il giorno del cambio ora legale', () => {
    // dopo l'ultima domenica di ottobre l'Italia è a UTC+1
    expect(slotRange('2025-10-28', 21 * 60, 60))
      .toBe('["2025-10-28T20:00:00.000Z","2025-10-28T21:00:00.000Z")')
  })
})

import { describe, expect, it } from 'vitest'
import { labelToMin, minToLabel, slotRange } from './tz'

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

// BandDialog's time selects depend on this round trip for every option they
// offer, 1440 above all: `<input type="time">` cannot hold "24:00" (the
// WHATWG valid-time-string grammar caps the hour at 23), which is the bug
// that moved those fields to a <select> in the first place. Covering every
// quarter-hour — the finest `slot_minutes` the database allows — is what
// would have caught it.
describe('labelToMin(minToLabel(x)) === x', () => {
  it('holds for every quarter-hour of the day, midnight at both ends included', () => {
    for (let min = 0; min <= 1440; min += 15) {
      expect(labelToMin(minToLabel(min))).toBe(min)
    }
  })
})

import { describe, expect, it } from 'vitest'
import { countOccurrences, defaultSeasonEnd } from './recurrence'

describe('countOccurrences', () => {
  it('conta gli estremi inclusi', () => {
    // martedì 5, 12, 19, 26 novembre 2030
    expect(countOccurrences(new Date(2030, 10, 5), new Date(2030, 10, 30))).toBe(4)
  })
  it('una data sola vale una occorrenza', () => {
    expect(countOccurrences(new Date(2030, 10, 5), new Date(2030, 10, 5))).toBe(1)
  })
  it('una fine prima dell’inizio non vale nulla', () => {
    expect(countOccurrences(new Date(2030, 10, 5), new Date(2030, 9, 1))).toBe(0)
  })
  it('non conta la settimana che sfora di un giorno', () => {
    expect(countOccurrences(new Date(2030, 10, 5), new Date(2030, 10, 11))).toBe(1)
  })
  it('non perde l’ultima data per via dell’ora della prenotazione', () => {
    // la prenotazione è delle 21:00, la fine è una data scelta col calendario
    expect(countOccurrences(
      new Date(2030, 10, 5, 21, 0), new Date(2030, 11, 3, 12, 0))).toBe(5)
  })
})

describe('defaultSeasonEnd', () => {
  it('da ottobre punta al maggio dell’anno dopo', () => {
    expect(defaultSeasonEnd(new Date(2030, 9, 8))).toEqual(new Date(2031, 4, 31))
  })
  it('da febbraio punta al maggio dello stesso anno', () => {
    expect(defaultSeasonEnd(new Date(2031, 1, 4))).toEqual(new Date(2031, 4, 31))
  })
})

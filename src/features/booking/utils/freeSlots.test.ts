import { describe, expect, it } from 'vitest'
import { freeSlots } from './freeSlots'

// Le partenze che `slot_prices` restituisce per un campo aperto 15:00–24:00
// con passo di mezz'ora e slot da un'ora: 15:00 … 23:00, l'ultima è quella
// che finisce alle 24:00.
const starts = Array.from({ length: 17 }, (_, i) => 15 * 60 + i * 30)
const base = { starts, durationMin: 60 }

describe('freeSlots', () => {
  it('senza occupazioni offre tutte le partenze prezzate', () => {
    expect(freeSlots({ ...base, busy: [] })).toHaveLength(17)
    expect(freeSlots({ ...base, busy: [] })[0]).toBe(900)
    expect(freeSlots({ ...base, busy: [] }).at(-1)).toBe(1380)
  })

  it('toglie le partenze che si sovrappongono a una prenotazione', () => {
    // occupato 20:00–21:30: cadono le partenze 19:30, 20:00, 20:30, 21:00
    const out = freeSlots({ ...base, busy: [[1200, 1290]] })
    expect(out).not.toContain(1170)
    expect(out).not.toContain(1200)
    expect(out).not.toContain(1260)
    expect(out).toContain(1140)
    expect(out).toContain(1290)
  })

  it('gli estremi si toccano ma non si sovrappongono', () => {
    // una prenotazione 20:00–21:00 lascia libera la partenza delle 21:00
    expect(freeSlots({ ...base, busy: [[1200, 1260]] })).toContain(1260)
  })

  it('non offre partenze già passate se il giorno è oggi', () => {
    const out = freeSlots({ ...base, busy: [], nowMin: 19 * 60 + 10 })
    expect(out[0]).toBe(1170)  // 19:30, la prima mezz'ora dopo le 19:10
  })

  it('non offre partenze oltre l’istante d’orizzonte', () => {
    // ultimo giorno prenotabile, e adesso sono le 10:00: `create_booking`
    // accetta solo le partenze fino a quell'ora, non tutto il giorno.
    const out = freeSlots({ ...base, busy: [], maxStartMin: 18 * 60 })
    expect(out.at(-1)).toBe(1080)
    expect(out).not.toContain(1110)
  })

  it('non inventa partenze che slot_prices non ha prezzato', () => {
    // il buco fra due fasce: slot_prices salta le 18:00 e le 18:30, e
    // l'elenco non le fa ricomparire senza prezzo.
    const out = freeSlots({
      starts: starts.filter((s) => s !== 1080 && s !== 1110),
      durationMin: 60,
      busy: [],
    })
    expect(out).not.toContain(1080)
    expect(out).not.toContain(1110)
    expect(out).toHaveLength(15)
  })
})

import { describe, expect, it } from 'vitest'
import { freeSlots } from './freeSlots'

const base = { openMin: 15 * 60, closeMin: 24 * 60, stepMin: 30, durationMin: 60 }

describe('freeSlots', () => {
  it('senza occupazioni offre tutte le partenze che ci stanno', () => {
    // 15:00 … 23:00 ogni mezz'ora: l'ultima partenza è quella che finisce alle 24:00
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

  it('una durata più lunga riduce le partenze possibili', () => {
    expect(freeSlots({ ...base, durationMin: 120, busy: [] }).at(-1)).toBe(1320)
  })

  it('non offre partenze già passate se il giorno è oggi', () => {
    const out = freeSlots({ ...base, busy: [], nowMin: 19 * 60 + 10 })
    expect(out[0]).toBe(1170)  // 19:30, la prima mezz'ora dopo le 19:10
  })
})

import { describe, expect, it } from 'vitest'
import { horizonLimit, maxStartMinForDay } from './horizon'

describe('horizonLimit', () => {
  it('conta ore, non giorni di calendario', () => {
    // 7 settembre 2026, 14:00 di Roma (CEST, +02). A 61 giorni di distanza
    // c'è il cambio dell'ora legale del 25 ottobre: il database, che somma
    // 61 × 24 ore in UTC, arriva alle 13:00 di Roma (CET, +01) — non alle
    // 14:00 come farebbe un conteggio a giorni di calendario.
    const now = new Date('2026-09-07T14:00:00+02:00')
    const limit = horizonLimit(now, 61)
    expect(limit.toISOString()).toBe('2026-11-07T12:00:00.000Z')
  })
})

describe('maxStartMinForDay', () => {
  const limit = new Date('2026-11-07T12:00:00Z')  // 13:00 a Roma

  it('non limita i giorni prima dell’orizzonte', () => {
    expect(maxStartMinForDay(new Date('2026-11-06T10:00:00Z'), limit))
      .toBeUndefined()
  })

  it('nel giorno dell’orizzonte limita all’ora del limite', () => {
    expect(maxStartMinForDay(new Date('2026-11-07T08:00:00Z'), limit))
      .toBe(13 * 60)
  })

  it('svuota i giorni interamente oltre l’orizzonte', () => {
    expect(maxStartMinForDay(new Date('2026-11-08T08:00:00Z'), limit)).toBe(-1)
  })

  it('guarda il giorno nel fuso della struttura, non del dispositivo', () => {
    // 23:30 UTC del 7 novembre è già lo 8 novembre a Roma: il giorno
    // mostrato è oltre l'orizzonte, non quello dell'orizzonte.
    expect(maxStartMinForDay(new Date('2026-11-07T23:30:00Z'), limit)).toBe(-1)
  })
})

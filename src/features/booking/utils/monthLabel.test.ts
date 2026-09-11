import { describe, expect, it } from 'vitest'
import { monthLabel } from './monthLabel'

// Oggi è lunedì 7 settembre 2026, per i tre casi calcolati nel compito.
const now = new Date('2026-09-07T10:00:00+02:00')

describe('monthLabel', () => {
  it('un mese solo, dentro l’anno corrente: niente anno', () => {
    // 7 → 13 settembre 2026, la finestra di partenza.
    expect(monthLabel(new Date('2026-09-07T00:00:00+02:00'), now)).toBe('settembre')
  })

  it('attraversa il mese, stesso anno: entrambi i mesi, niente anno', () => {
    // 28 settembre → 4 ottobre 2026, la quarta finestra (tre clic in avanti).
    expect(monthLabel(new Date('2026-09-28T00:00:00+02:00'), now))
      .toBe('settembre – ottobre')
  })

  it('attraversa il mese e l’anno: entrambi gli anni', () => {
    // 28 dicembre 2026 → 3 gennaio 2027.
    expect(monthLabel(new Date('2026-12-28T00:00:00+01:00'), now))
      .toBe('dicembre 2026 – gennaio 2027')
  })
})

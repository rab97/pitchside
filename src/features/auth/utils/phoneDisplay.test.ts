import { describe, expect, it } from 'vitest'
import { displayPhone } from './phoneDisplay'

describe('displayPhone', () => {
  it('rimette il più e stacca il prefisso italiano', () => {
    expect(displayPhone('393331112233')).toBe('+39 3331112233')
  })

  it('non raggruppa il numero nazionale', () => {
    // Un raggruppamento inventato è peggio del numero intero: «333 11 12 233»
    // non è il modo in cui nessuno scrive quel numero. L'unico spazio è
    // quello che stacca il prefisso.
    expect(displayPhone('393331112233').split(' ')).toHaveLength(2)
  })

  it('accetta anche il numero già col più', () => {
    expect(displayPhone('+39 333 111 22 33')).toBe('+39 3331112233')
  })

  it('un prefisso che non è il nostro resta intero', () => {
    expect(displayPhone('33612345678')).toBe('+33612345678')
  })

  it('senza numero non scrive un più solitario', () => {
    expect(displayPhone(null)).toBe('')
    expect(displayPhone(undefined)).toBe('')
    expect(displayPhone('')).toBe('')
  })
})

import { describe, expect, it } from 'vitest'
import { messageForCustomer } from './useBookAsMember'

describe('messageForCustomer', () => {
  it('la collisione diventa una frase, non un codice', () => {
    expect(messageForCustomer('PS004'))
      .toBe('Qualcuno ha appena preso questo slot. Scegline un altro.')
  })
  it('spiega l’orizzonte invece di dire di no', () => {
    expect(messageForCustomer('PS007'))
      .toMatch(/non si può ancora prenotare così avanti/i)
  })
  it('ha un messaggio di riserva', () => {
    expect(messageForCustomer('ZZZZZ')).toMatch(/non è riuscita/i)
  })
})

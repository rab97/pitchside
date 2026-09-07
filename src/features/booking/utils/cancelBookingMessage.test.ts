import { describe, expect, it } from 'vitest'
import { messageForCustomer } from './cancelBookingMessage'

describe('messageForCustomer', () => {
  it('dice di ricaricare, non che manca la riga', () => {
    expect(messageForCustomer('PS009')).toMatch(/ricarica/i)
  })
  it('dice che non è sua, non che è vietato', () => {
    expect(messageForCustomer('PS013')).toBe('Non puoi disdire una prenotazione che non è tua.')
  })
  it('ha un messaggio di riserva per un codice ignoto', () => {
    expect(messageForCustomer('ZZZZZ')).toMatch(/non è riuscita/i)
  })
})

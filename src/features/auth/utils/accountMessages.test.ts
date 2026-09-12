import { describe, expect, it } from 'vitest'
import { accountMessage, isEmailTaken } from './accountMessages'

describe('accountMessages', () => {
  it('riconosce un indirizzo già usato da un altro account', () => {
    expect(isEmailTaken({ code: 'email_exists' })).toBe(true)
    expect(isEmailTaken({ message: 'A user with this email address has already been registered' }))
      .toBe(true)
    expect(isEmailTaken({ message: 'network error' })).toBe(false)
    expect(isEmailTaken(null)).toBe(false)
  })

  it('dice cosa non è riuscito e cosa si può fare, non cosa ha risposto il servizio', () => {
    expect(accountMessage(new Error('boom'), 'email'))
      .toBe('Non siamo riusciti a salvare l’indirizzo. Riprova.')
    expect(accountMessage(new Error('boom'), 'google'))
      .toBe('Non siamo riusciti a collegare Google. Riprova.')
    expect(accountMessage(new Error('boom'), 'signout'))
      .toBe('Non siamo riusciti a uscire. Riprova.')
  })

  it('sull’indirizzo già preso spiega la situazione invece di dire che è un errore', () => {
    expect(accountMessage({ code: 'email_exists' }, 'email'))
      .toBe('Questo indirizzo è già collegato a un altro account. Entra con quello, oppure usane uno diverso.')
  })
})

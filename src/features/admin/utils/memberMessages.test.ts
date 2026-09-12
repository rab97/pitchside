import { describe, expect, it } from 'vitest'
import { isPhoneTaken, memberMessage } from './memberMessages'

describe('memberMessages', () => {
  it('riconosce la violazione di unicità del telefono', () => {
    expect(isPhoneTaken({ code: '23505' })).toBe(true)
    expect(isPhoneTaken({ code: '23514' })).toBe(false)
    expect(isPhoneTaken(new Error('boom'))).toBe(false)
  })

  it('dice cosa non è riuscito, non cosa ha risposto il database', () => {
    expect(memberMessage(new Error('boom'), 'save'))
      .toBe('Non siamo riusciti a salvare la nota. Riprova.')
    expect(memberMessage(new Error('boom'), 'create'))
      .toBe('Non siamo riusciti a creare il cliente. Riprova.')
  })

  it('sulla collisione del telefono spiega cosa è successo, non che è un errore', () => {
    expect(memberMessage({ code: '23505' }, 'create'))
      .toBe('Questo numero è già di un altro cliente. Qualcuno potrebbe averlo appena creato: cerca di nuovo.')
  })
})

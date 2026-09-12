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

  // «cerca di nuovo» was the one suggestion that cannot work: the manager is
  // creating a customer precisely because searching by the name they have
  // found nothing. The two choices are the existing card, offered beside this
  // sentence, or a corrected number — never a customer without one, which
  // §2.6 no longer allows.
  it('sulla collisione del telefono offre le due scelte che esistono davvero', () => {
    expect(memberMessage({ code: '23505' }, 'create'))
      .toBe('Questo numero è già di un altro cliente: usa la sua scheda, oppure correggi il numero.')
  })
})

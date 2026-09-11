import { describe, expect, it } from 'vitest'
import { messageForClosureWrite } from './closureMessages'

describe('messageForClosureWrite', () => {
  it('says plainly when the manager does not administer this facility', () => {
    // PS016 is create_closure's own authorization check.
    expect(messageForClosureWrite({ code: 'PS016' }))
      .toBe('Non hai i permessi per chiudere questo impianto.')
  })

  it('falls back without inventing a cause', () => {
    expect(messageForClosureWrite({ code: 'XX000' }))
      .toBe('Non siamo riusciti a salvare la chiusura. Riprova.')
    expect(messageForClosureWrite(null))
      .toBe('Non siamo riusciti a salvare la chiusura. Riprova.')
  })
})

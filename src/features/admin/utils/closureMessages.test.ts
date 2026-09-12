import { describe, expect, it } from 'vitest'
import {
  messageForClosureConflictsError,
  messageForClosureDelete,
  messageForClosureWrite,
} from './closureMessages'

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

describe('messageForClosureConflictsError', () => {
  it('says the check could not be made, whatever the underlying cause', () => {
    expect(messageForClosureConflictsError(new Error('network down')))
      .toBe('Non siamo riusciti a controllare le prenotazioni in questo periodo.')
    expect(messageForClosureConflictsError(null))
      .toBe('Non siamo riusciti a controllare le prenotazioni in questo periodo.')
  })
})

describe('messageForClosureDelete', () => {
  it('says "eliminare", not "salvare" — a delete failed, not a save', () => {
    expect(messageForClosureDelete(new Error('boom')))
      .toBe('Non siamo riusciti a eliminare la chiusura. Riprova.')
    expect(messageForClosureDelete(null))
      .toBe('Non siamo riusciti a eliminare la chiusura. Riprova.')
  })
})

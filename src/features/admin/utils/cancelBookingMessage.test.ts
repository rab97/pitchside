import { describe, expect, it } from 'vitest'
import { messageForError } from './cancelBookingMessage'

describe('messageForError', () => {
  it('dice che era già stata disdetta', () => {
    expect(messageForError('PS010')).toBe('Era già stata disdetta.')
  })
  it('dice che non esiste più', () => {
    expect(messageForError('PS009')).toBe('Questa prenotazione non esiste più.')
  })
  it('dice che devi accedere', () => {
    expect(messageForError('PS012')).toBe('Devi accedere per disdire.')
  })
  it('ha un messaggio di riserva per un codice ignoto', () => {
    expect(messageForError('ZZZZZ')).toMatch(/non è riuscita/i)
  })
})

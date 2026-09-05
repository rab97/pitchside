import { describe, expect, it } from 'vitest'
import { messageForError } from './useCreateBooking'

describe('messageForError', () => {
  it('traduce la collisione in una frase utile', () => {
    expect(messageForError('P0004'))
      .toBe('Questo slot è appena stato prenotato da qualcun altro. Scegline un altro.')
  })
  it('traduce lo slot fuori orario', () => {
    expect(messageForError('P0005'))
      .toBe('Non c’è una tariffa per quell’orario: il campo è fuori apertura.')
  })
  it('ha un messaggio di riserva', () => {
    expect(messageForError('XXXXX')).toMatch(/non è riuscita/i)
  })
})

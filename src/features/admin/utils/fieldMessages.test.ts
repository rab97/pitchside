import { describe, expect, it } from 'vitest'
import { messageForFieldWrite } from './fieldMessages'

describe('messageForFieldWrite', () => {
  it('explains that a booked pitch is deactivated, not deleted', () => {
    // 23503 is the foreign key violation Postgres raises for
    // bookings.field_id, which is `on delete restrict`.
    expect(messageForFieldWrite({ code: '23503' }))
      .toBe('Questo campo ha prenotazioni: puoi disattivarlo, non eliminarlo.')
  })

  it('says plainly when the write was refused', () => {
    expect(messageForFieldWrite({ code: '42501' }))
      .toBe('Non hai i permessi per modificare questa struttura.')
  })

  it('falls back without inventing a cause', () => {
    expect(messageForFieldWrite({ code: 'XX000' }))
      .toBe('Non siamo riusciti a salvare il campo. Riprova.')
    expect(messageForFieldWrite(null))
      .toBe('Non siamo riusciti a salvare il campo. Riprova.')
  })
})

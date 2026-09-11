import { describe, expect, it } from 'vitest'
import { pickExistingMember } from './pickMember'

const rows = [
  { id: 'm1', name: 'Marco Ferrero', phone: '3472201563' },
  { id: 'm2', name: 'Bianchi', phone: null },
  { id: 'm3', name: 'Rossi', phone: null },
  { id: 'm4', name: 'Rossi', phone: null },
]

describe('pickExistingMember', () => {
  it('il telefono decide da solo, anche scritto con gli spazi', () => {
    expect(pickExistingMember(rows, 'Chiunque', '347 220 15 63')).toBe('m1')
  })

  it('senza telefono usa il nome, se la corrispondenza è unica', () => {
    expect(pickExistingMember(rows, 'bianchi', '')).toBe('m2')
  })

  it('non sceglie fra due omonimi', () => {
    expect(pickExistingMember(rows, 'Rossi', '')).toBeNull()
  })

  it('un nome mai visto non corrisponde a nessuno', () => {
    expect(pickExistingMember(rows, 'Conti', '')).toBeNull()
  })

  it('un telefono mai visto non ripiega sul nome', () => {
    expect(pickExistingMember(rows, 'Bianchi', '3331234567')).toBeNull()
  })
})

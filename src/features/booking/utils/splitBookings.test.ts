import { describe, expect, it } from 'vitest'
import { splitBookings } from './splitBookings'
import type { MyBooking } from '../hooks/useMyBookings'

const now = new Date('2026-09-07T10:00:00Z')

function booking(overrides: Partial<MyBooking>): MyBooking {
  return {
    id: 'b1',
    field_name: 'Campo 1',
    field_kind: 'calcio5',
    slot_start: new Date('2026-09-08T18:00:00Z'),
    slot_end: new Date('2026-09-08T19:00:00Z'),
    status: 'active',
    price_cents: 3500,
    cancel_deadline: '2026-09-07T18:00:00Z',
    ...overrides,
  }
}

describe('splitBookings', () => {
  it('mette fra le future una prenotazione attiva non ancora avvenuta', () => {
    const b = booking({ id: 'f1' })
    const { future, past } = splitBookings([b], now)
    expect(future.map((x) => x.id)).toEqual(['f1'])
    expect(past).toHaveLength(0)
  })

  it('mette fra le passate una prenotazione attiva già avvenuta', () => {
    const b = booking({ id: 'p1', slot_start: new Date('2026-09-01T18:00:00Z') })
    const { future, past } = splitBookings([b], now)
    expect(future).toHaveLength(0)
    expect(past.map((x) => x.id)).toEqual(['p1'])
  })

  it('una disdetta resta fra le passate anche se lo slot deve ancora arrivare', () => {
    const b = booking({
      id: 'c1', status: 'cancelled', slot_start: new Date('2026-09-20T18:00:00Z'),
    })
    const { future, past } = splitBookings([b], now)
    expect(future).toHaveLength(0)
    expect(past.map((x) => x.id)).toEqual(['c1'])
  })

  it('le future sono ordinate dalla più vicina alla più lontana', () => {
    const near = booking({ id: 'near', slot_start: new Date('2026-09-08T18:00:00Z') })
    const far = booking({ id: 'far', slot_start: new Date('2026-09-15T18:00:00Z') })
    const { future } = splitBookings([far, near], now)
    expect(future.map((x) => x.id)).toEqual(['near', 'far'])
  })

  it('le passate sono ordinate dalla più recente alla più lontana', () => {
    const recent = booking({ id: 'recent', slot_start: new Date('2026-09-05T18:00:00Z') })
    const old = booking({ id: 'old', slot_start: new Date('2026-08-20T18:00:00Z') })
    const { past } = splitBookings([old, recent], now)
    expect(past.map((x) => x.id)).toEqual(['recent', 'old'])
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DayGrid } from './DayGrid'
import * as hooks from '../hooks/useDayBookings'

const fields = [{ id: 'c1', name: 'Campo 1', kind: 'calcio5', covered: true, sort_order: 1 }]

describe('DayGrid', () => {
  it('disegna una prenotazione col nome e la fascia oraria', () => {
    vi.spyOn(hooks, 'useDayBookings').mockReturnValue({
      isPending: false,
      fields,
      bookings: [{
        id: 'b1', field_id: 'c1', member_name: 'Rossi',
        slot_start: new Date('2025-10-14T20:00:00+02:00'),
        slot_end: new Date('2025-10-14T21:30:00+02:00'),
        source: 'phone', price_cents: 3750, status: 'active',
      }],
    } as never)

    render(<DayGrid day={new Date('2025-10-14T00:00:00+02:00')} onSlotClick={() => {}} />)
    expect(screen.getByText('Rossi')).toBeInTheDocument()
    expect(screen.getByText(/20:00–21:30/)).toBeInTheDocument()
  })

  it('mostra il campo anche quando non ha prenotazioni', () => {
    vi.spyOn(hooks, 'useDayBookings').mockReturnValue(
      { isPending: false, fields, bookings: [] } as never)
    render(<DayGrid day={new Date()} onSlotClick={() => {}} />)
    expect(screen.getByText('Campo 1')).toBeInTheDocument()
  })
})

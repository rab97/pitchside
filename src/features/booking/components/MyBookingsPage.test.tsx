import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MyBookingsPage } from './MyBookingsPage'
import * as auth from '@/features/auth/hooks/AuthProvider'
import * as tenant from '@/shared/tenant/FacilityProvider'
import * as hooks from '../hooks/useMyBookings'

// La riga di «le tue prenotazioni» era un `<li>` senza collegamento: la
// pagina di dettaglio — e con essa tutta la funzione «disdici» della spec
// §5.3 — era raggiungibile solo digitando un UUID a mano. È un difetto di
// COLLEGAMENTO, e si vede solo rendendo la lista e cercando il link.
const booking = {
  id: 'b1',
  field_name: 'Campo 1',
  field_kind: 'calcio5',
  slot_start: new Date('2025-10-14T20:00:00+02:00'),
  slot_end: new Date('2025-10-14T21:30:00+02:00'),
  status: 'active',
  price_cents: 3750,
  cancel_deadline: '2025-10-14T14:00:00+02:00',
}

function renderPage() {
  vi.spyOn(auth, 'useAuth').mockReturnValue(
    { session: {} as never, isAdmin: false, loading: false })
  vi.spyOn(tenant, 'useFacility').mockReturnValue(
    { name: 'Palacalcetto' } as never)
  vi.spyOn(hooks, 'useMyBookings').mockReturnValue(
    { future: [booking], past: [], isPending: false, error: null } as never)

  render(<MemoryRouter><MyBookingsPage /></MemoryRouter>)
}

describe('MyBookingsPage', () => {
  it('porta al dettaglio della prenotazione', () => {
    renderPage()
    const link = screen.getByRole('link', { name: /prenotazione del 14 ottobre/i })
    expect(link).toHaveAttribute('href', '/prenotazioni/b1')
  })

  it('dà al collegamento un nome leggibile, non tutta la riga', () => {
    renderPage()
    // Senza aria-label il nome accessibile sarebbe la concatenazione di data,
    // orario, campo, prezzo e stato: qui deve dire quale prenotazione apre.
    expect(
      screen.getByRole('link', { name: 'Prenotazione del 14 ottobre alle 20:00, Campo 1' }),
    ).toBeInTheDocument()
  })
})

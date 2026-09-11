import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { MobileTopBar } from './MobileTopBar'
import * as tenant from '@/shared/tenant/FacilityProvider'

const facility = {
  id: 'f1', slug: 'palacalcetto', name: 'Palacalcetto', color: '#1f7a3f',
  phone: null, address: null, cancel_hours: 24, booking_horizon_days: 60,
  slot_minutes: 30, min_duration_minutes: 60, features: {},
} as never

function renderBar(props: { title: string; backTo?: string }) {
  vi.spyOn(tenant, 'useFacility').mockReturnValue(facility)
  return render(
    <MemoryRouter>
      <MobileTopBar {...props} />
    </MemoryRouter>,
  )
}

describe('MobileTopBar', () => {
  it('su una radice di tab mostra il marchietto, non un indietro', () => {
    renderBar({ title: 'Prenota' })

    expect(screen.getByText('Prenota')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Torna indietro' })).not.toBeInTheDocument()
  })

  it('su una schermata spinta l\'indietro punta al genitore, non alla cronologia', () => {
    renderBar({ title: 'Prenotazione', backTo: '/prenotazioni' })

    // Un indirizzo, non `history.back()`: chi entra da un link o rientra
    // dopo l'accesso ha una cronologia che punta fuori dall'app.
    expect(screen.getByRole('link', { name: 'Torna indietro' }))
      .toHaveAttribute('href', '/prenotazioni')
  })

  it('il titolo non è un h1: la pagina può averne già uno nel contenuto', () => {
    renderBar({ title: 'Prenotazione', backTo: '/prenotazioni' })

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})

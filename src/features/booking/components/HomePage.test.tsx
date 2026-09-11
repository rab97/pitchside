import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { HomePage } from './HomePage'
import * as auth from '@/features/auth/hooks/AuthProvider'
import * as tenant from '@/shared/tenant/FacilityProvider'
import * as fields from '@/shared/hooks/useFields'
import { FIELDS_ERROR, NO_FIELDS } from '../utils/messages'

// Caricamento, vuoto e guasto sono tre stati diversi e devono dirsi in tre
// modi diversi: `useFields` non esponeva `isPending` né `error`, quindi la
// home diceva «Nessun campo disponibile al momento.» mentre l'elenco stava
// arrivando, e lo diceva anche quando la richiesta era fallita.
function renderWith(state: Partial<ReturnType<typeof fields.useFields>>) {
  vi.spyOn(auth, 'useAuth').mockReturnValue(
    { session: null, isAdmin: false, loading: false })
  vi.spyOn(tenant, 'useFacility').mockReturnValue(
    { name: 'Palacalcetto', address: 'Via dello Sport 14', phone: null } as never)
  vi.spyOn(fields, 'useFields').mockReturnValue(
    { fields: [], isPending: false, error: null, ...state } as never)

  render(<MemoryRouter><HomePage /></MemoryRouter>)
}

describe('HomePage', () => {
  it('durante il caricamento non dice che non ci sono campi', () => {
    renderWith({ isPending: true })
    expect(screen.getByText('Caricamento…')).toBeInTheDocument()
    expect(screen.queryByText(NO_FIELDS)).not.toBeInTheDocument()
  })

  it('a elenco vuoto lo dice, e con la frase condivisa', () => {
    renderWith({})
    expect(screen.getByText(NO_FIELDS)).toBeInTheDocument()
  })

  it('un guasto è un errore, non un elenco vuoto', () => {
    renderWith({ error: new Error('boom') })
    expect(screen.getByRole('alert')).toHaveTextContent(FIELDS_ERROR)
    expect(screen.queryByText(NO_FIELDS)).not.toBeInTheDocument()
  })
})

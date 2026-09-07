import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { LoginPage, toE164 } from './LoginPage'
import * as tenant from '@/shared/tenant/FacilityProvider'
import * as auth from '../hooks/AuthProvider'

describe('toE164', () => {
  it('aggiunge il prefisso italiano a un numero nazionale', () => {
    expect(toE164('347 220 15 63')).toBe('+393472201563')
  })
  it('non lo raddoppia se c’è già', () => {
    expect(toE164('39 347 220 15 63')).toBe('+393472201563')
  })
  it('accetta la forma con doppio zero', () => {
    expect(toE164('0039 347 220 15 63')).toBe('+393472201563')
  })
})

describe('LoginPage', () => {
  it('offre Google come prima strada e l’SMS come ripiego', () => {
    vi.spyOn(tenant, 'useFacility').mockReturnValue(
      { id: 'f1', name: 'Palacalcetto', address: 'Alba' } as never)
    vi.spyOn(auth, 'useAuth').mockReturnValue(
      { session: null, isAdmin: false, loading: false })
    render(<MemoryRouter><LoginPage /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /continua con google/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/numero di telefono/i)).toBeInTheDocument()
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RequireAdmin } from './RequireAdmin'
import * as auth from '../hooks/AuthProvider'

describe('RequireAdmin', () => {
  it('mostra i figli a un amministratore', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue(
      { session: {} as never, isAdmin: true, loading: false })
    render(<RequireAdmin><p>griglia</p></RequireAdmin>)
    expect(screen.getByText('griglia')).toBeInTheDocument()
  })

  it('nega l’accesso a chi non è amministratore', () => {
    vi.spyOn(auth, 'useAuth').mockReturnValue(
      { session: {} as never, isAdmin: false, loading: false })
    render(<RequireAdmin><p>griglia</p></RequireAdmin>)
    expect(screen.queryByText('griglia')).not.toBeInTheDocument()
    expect(screen.getByText(/non hai accesso/i)).toBeInTheDocument()
  })
})

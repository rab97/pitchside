import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ProfilePage } from './ProfilePage'
import * as authProvider from '../hooks/AuthProvider'
import * as signOutHook from '../hooks/useSignOut'
import * as emailHook from '../hooks/useUpdateEmail'
import * as googleHook from '../hooks/useLinkGoogle'
import * as tenant from '@/shared/tenant/FacilityProvider'

const facility = {
  id: 'f1', slug: 'palacalcetto', name: 'Palacalcetto', color: '#1f7a3f',
  phone: null, address: null, cancel_hours: 24, booking_horizon_days: 60,
  slot_minutes: 30, min_duration_minutes: 60, features: {},
} as never

function stubHooks() {
  // `MobileFrame` monta la barra alta, che chiede la struttura: senza questo
  // `useFacility` solleva, e nessuna asserzione arriverebbe mai.
  vi.spyOn(tenant, 'useFacility').mockReturnValue(facility)
  vi.spyOn(signOutHook, 'useSignOut').mockReturnValue({
    signOut: vi.fn(), leaving: false, error: null,
  })
  vi.spyOn(emailHook, 'useUpdateEmail').mockReturnValue({
    setEmail: vi.fn(), saving: false, error: null, sent: false,
  })
  vi.spyOn(googleHook, 'useLinkGoogle').mockReturnValue({
    linkGoogle: vi.fn(), linking: false, error: null,
  })
}

function stubSession(user: Record<string, unknown> | null) {
  vi.spyOn(authProvider, 'useAuth').mockReturnValue({
    session: user ? ({ user } as never) : null,
    isAdmin: false,
    loading: false,
  })
}

function renderPage() {
  return render(<MemoryRouter><ProfilePage /></MemoryRouter>)
}

describe('ProfilePage', () => {
  beforeEach(() => { vi.restoreAllMocks(); stubHooks() })

  it('chi non è entrato viene invitato, non respinto', () => {
    stubSession(null)
    renderPage()
    expect(screen.getByRole('link', { name: /accedi/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Esci' })).not.toBeInTheDocument()
  })

  it('mostra il numero con cui si entra', () => {
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()
    expect(screen.getByText(/3331112233/)).toBeInTheDocument()
  })

  it('un indirizzo in attesa è detto in attesa, non come se funzionasse', () => {
    stubSession({
      phone: '393331112233', email: null,
      new_email: 'rossi@example.com', identities: [],
    })
    renderPage()
    expect(screen.getByText(/in attesa di conferma/i)).toBeInTheDocument()
    expect(screen.getByText(/rossi@example.com/)).toBeInTheDocument()
  })

  it('un indirizzo confermato è mostrato senza avvisi', () => {
    stubSession({
      phone: '393331112233', email: 'rossi@example.com', identities: [],
    })
    renderPage()
    expect(screen.getByText(/rossi@example.com/)).toBeInTheDocument()
    expect(screen.queryByText(/in attesa di conferma/i)).not.toBeInTheDocument()
  })

  it('offre di collegare Google solo se non è già collegato', () => {
    stubSession({ phone: '393331112233', email: null, identities: [] })
    const { unmount } = renderPage()
    expect(screen.getByRole('button', { name: /collega google/i })).toBeInTheDocument()
    unmount()

    stubSession({
      phone: '393331112233', email: 'rossi@example.com',
      identities: [{ provider: 'google' }],
    })
    renderPage()
    expect(screen.queryByRole('button', { name: /collega google/i })).not.toBeInTheDocument()
  })

  it('l’uscita chiama signOut', async () => {
    const signOut = vi.fn()
    vi.spyOn(signOutHook, 'useSignOut').mockReturnValue({ signOut, leaving: false, error: null })
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()
    screen.getByRole('button', { name: 'Esci' }).click()
    expect(signOut).toHaveBeenCalled()
  })

  it('dice se il salvataggio dell’indirizzo non è riuscito', () => {
    vi.spyOn(emailHook, 'useUpdateEmail').mockReturnValue({
      setEmail: vi.fn(), saving: false, sent: false,
      error: 'Questo indirizzo è già collegato a un altro account. Entra con quello, oppure usane uno diverso.',
    })
    stubSession({ phone: '393331112233', email: null, identities: [] })
    renderPage()
    expect(screen.getByText(/già collegato a un altro account/)).toBeInTheDocument()
  })

  // La distinzione fra «la mail è partita» e «l'indirizzo funziona» non si può
  // mettere alla prova dentro `useUpdateEmail`: il gancio è un involucro
  // attorno a una chiamata sola, e quella differenza vive nell'assenza di un
  // cambiamento. Qui invece c'è qualcosa che può cambiare — l'elenco dei dati
  // dell'account — e questa è l'asserzione che impedisce di far collassare
  // «in attesa» in «salvato».
  it('a messaggio partito l’indirizzo non entra fra i dati dell’account', () => {
    vi.spyOn(emailHook, 'useUpdateEmail').mockReturnValue({
      setEmail: vi.fn(), saving: false, error: null, sent: true,
    })
    stubSession({
      phone: '393331112233', email: null,
      new_email: 'rossi@example.com', identities: [],
    })
    renderPage()

    const account = screen.getByRole('list', { name: 'Dati dell’account' })
    // Il numero sì: se questo sparisse, l'asserzione qui sotto passerebbe
    // anche su un elenco vuoto, cioè su nulla.
    expect(within(account).getByText(/3331112233/)).toBeInTheDocument()
    expect(within(account).queryByText(/rossi@example.com/)).not.toBeInTheDocument()
    expect(screen.getByText(/in attesa di conferma/i)).toBeInTheDocument()
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { BookPage } from './BookPage'
import * as auth from '@/features/auth/hooks/AuthProvider'
import * as tenant from '@/shared/tenant/FacilityProvider'
import * as fields from '@/shared/hooks/useFields'
import * as availability from '../hooks/useAvailability'
import * as slotPrices from '../hooks/useSlotPrices'

const facility = {
  id: 'f1', slug: 'palacalcetto', name: 'Palacalcetto', color: '#1f7a3f',
  phone: null, address: null, cancel_hours: 24, booking_horizon_days: 60,
  slot_minutes: 30, min_duration_minutes: 60, features: {},
} as never

const fieldRows = [
  { id: 'c1', name: 'Campo 1', kind: 'calcio5', covered: true, sort_order: 1 },
]

// Le 20:00 di un giorno qualunque: abbastanza lontane da mezzanotte e da
// qualunque ora vera dell'orologio da non farsi filtrare da `nowMin`, e
// dentro l'orizzonte di 60 giorni da non farsi filtrare da `maxStartMin`.
function renderBookPage(state: {
  busyPlaceholder?: boolean
  pricesPlaceholder?: boolean
}) {
  vi.spyOn(auth, 'useAuth').mockReturnValue(
    { session: null, isAdmin: false, loading: false })
  vi.spyOn(tenant, 'useFacility').mockReturnValue(facility)
  vi.spyOn(fields, 'useFields').mockReturnValue(
    { fields: fieldRows, isPending: false, error: null } as never)
  vi.spyOn(availability, 'useAvailability').mockReturnValue({
    busy: [], isPending: false, isPlaceholderData: !!state.busyPlaceholder, error: null,
  })
  vi.spyOn(slotPrices, 'useSlotPrices').mockReturnValue({
    prices: new Map([[1200, 3000]]),
    isPending: false,
    isPlaceholderData: !!state.pricesPlaceholder,
    error: null,
  })

  // `ConfirmBookingDialog`, montato anche a riepilogo chiuso, chiama
  // `useMyMember` incondizionatamente: serve un QueryClient nell'albero anche
  // se qui la query non parte mai (nessuna sessione).
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter><BookPage /></MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('BookPage — elenco degli orari', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2025-10-14T08:00:00+02:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('durante un aggiornamento restano visibili gli orari, non un segnaposto', () => {
    const { container } = renderBookPage({ busyPlaceholder: true, pricesPlaceholder: true })

    // L'orario resta a schermo: niente «Caricamento…» al suo posto.
    expect(screen.getByText('20:00–21:00')).toBeInTheDocument()
    expect(screen.queryByText('Caricamento…')).not.toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).toBeInTheDocument()
  })

  it('a riposo non segnala nessun aggiornamento', () => {
    const { container } = renderBookPage({})
    expect(screen.getByText('20:00–21:00')).toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).not.toBeInTheDocument()
  })
})

describe('BookPage — il foglio di conferma su telefono', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2025-10-14T08:00:00+02:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('scelto un orario compare il foglio, con l\'importo già a schermo', () => {
    renderBookPage({})

    // Prima della scelta il foglio non c'è: nessuna maniglia da aprire.
    expect(screen.queryByRole('button', { name: 'Mostra il dettaglio' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('20:00–21:00').closest('button') as HTMLElement)

    const sheet = screen.getByRole('button', { name: 'Mostra il dettaglio' })
    expect(sheet).toBeInTheDocument()
    // L'importo si legge senza aprire niente: si sta confermando una spesa.
    expect(sheet.parentElement).toHaveTextContent('30,00 €')
  })
})

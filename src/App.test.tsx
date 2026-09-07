import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

// `ClaimPhoneDialog` era implementato, autonomo e corretto — e non montato da
// nessuna parte: `grep -rn ClaimPhoneDialog src` trovava solo la sua
// definizione. Nessun cliente entrato con Google dava mai un numero, quindi lo
// storico non si rivendicava e il gestore non aveva un numero per richiamare.
//
// È un difetto di MONTAGGIO, e nessun test di funzione pura può vederlo:
// serve rendere l'app e guardare se il componente c'è. Il dialogo vero è
// sostituito da un segnaposto perché qui la domanda è una sola, «App lo
// monta?», e non «cosa mostra».
vi.mock('@/features/auth/components/ClaimPhoneDialog', () => ({
  ClaimPhoneDialog: () => <div data-testid="claim-phone-dialog" />,
}))

// I provider vanno cortocircuitati o la prima schermata non arriva mai:
// `FacilityProvider` mostra «Caricamento…» finché non ha risolto la struttura
// dal database, e non c'è database in un test.
vi.mock('@/shared/tenant/FacilityProvider', () => ({
  FacilityProvider: ({ children }: { children: React.ReactNode }) => children,
  useFacility: () => ({
    id: 'f1', slug: 'test', name: 'Palacalcetto', color: '#146B3F',
    phone: null, address: null, cancel_hours: 6, booking_horizon_days: 14,
    slot_minutes: 30, min_duration_minutes: 60, features: {},
  }),
}))

vi.mock('@/features/auth/hooks/AuthProvider', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ session: null, isAdmin: false, loading: false }),
}))

vi.mock('@/shared/hooks/useFields', () => ({
  useFields: () => ({ fields: [], isPending: false, error: null }),
}))

import { App } from './App'

describe('App', () => {
  it('monta ClaimPhoneDialog per tutte le rotte cliente', () => {
    render(<App />)
    expect(screen.getByTestId('claim-phone-dialog')).toBeInTheDocument()
  })
})

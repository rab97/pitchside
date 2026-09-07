import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { resolveTenantHostname } from './resolveTenant'

export type Facility = {
  id: string
  slug: string
  name: string
  color: string
  phone: string | null
  address: string | null
  cancel_hours: number
  booking_horizon_days: number
  slot_minutes: number
  min_duration_minutes: number
  features: Record<string, boolean>
}

const Ctx = createContext<Facility | null>(null)

export function useFacility(): Facility {
  const f = useContext(Ctx)
  if (!f) throw new Error('useFacility fuori da FacilityProvider')
  return f
}

export function FacilityProvider({ children }: { children: ReactNode }) {
  const { data, isPending, error } = useQuery({
    queryKey: ['facility'],
    staleTime: Infinity,
    queryFn: async () => {
      const host = resolveTenantHostname()
      const { data, error } = await supabase
        .from('facility_domains')
        .select('facilities(*)')
        .eq('hostname', host)
        .single()
      if (error) throw error
      return data.facilities as unknown as Facility
    },
  })

  // Il branding è dati, non codice: una variabile CSS, non un tema ricompilato.
  // Si scrive --brand e non --pitch: da --brand index.css deriva l'accento e la
  // sua tinta, con una resa diversa per tema chiaro e scuro. Scrivere --pitch
  // direttamente imporrebbe a entrambi i temi un colore scelto per uno solo.
  useEffect(() => {
    if (data?.color) {
      document.documentElement.style.setProperty('--brand', data.color)
    }
  }, [data?.color])

  if (isPending) return <div className="p-8 text-muted">Caricamento…</div>
  if (error || !data) {
    return (
      <div className="p-8">
        <p>Struttura non trovata per questo indirizzo.</p>
        {/* Solo in sviluppo, e non per gentilezza: aprendo l'app da un
            indirizzo che non sta in `facility_domains` — l'indirizzo di rete
            della macchina, quando si prova dal telefono — la frase qui sopra è
            esatta ma sembra un guasto. Qui si dice invece come si esce, e in
            produzione questo ramo non arriva nel pacchetto. */}
        {import.meta.env.DEV && (
          <p className="mt-2 text-[13px] text-muted">
            Sei su <code>{window.location.hostname}</code>, che non è fra i
            domini registrati. In sviluppo puoi imporre la struttura con{' '}
            <code>VITE_TENANT_HOSTNAME=localhost</code>.
          </p>
        )}
      </div>
    )
  }

  return <Ctx.Provider value={data}>{children}</Ctx.Provider>
}

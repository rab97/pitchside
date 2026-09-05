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
  useEffect(() => {
    if (data?.color) {
      document.documentElement.style.setProperty('--pitch', data.color)
    }
  }, [data?.color])

  if (isPending) return <div className="p-8 text-muted">Caricamento…</div>
  if (error || !data) {
    return <div className="p-8">Struttura non trovata per questo indirizzo.</div>
  }

  return <Ctx.Provider value={data}>{children}</Ctx.Provider>
}

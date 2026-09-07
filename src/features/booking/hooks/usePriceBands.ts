import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import type { PriceBand } from '../utils/estimatePrice'

/**
 * Legge `price_bands`, che ha una policy di lettura pubblica: funziona anche
 * senza account, come `useAvailability`. Il prezzo che se ne ricava è una
 * stima — vedi `estimatePrice` — non il calcolo autorevole del database.
 */
export function usePriceBands(fieldId: string | null): PriceBand[] {
  const facility = useFacility()
  const { data } = useQuery({
    queryKey: ['price-bands', facility.id, fieldId],
    enabled: !!fieldId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<PriceBand[]> => {
      const { data, error } = await supabase
        .from('price_bands')
        .select('weekdays, starts_min, ends_min, price_cents')
        .eq('facility_id', facility.id)
        .eq('field_id', fieldId!)
      if (error) throw error
      return data
    },
  })
  return data ?? []
}

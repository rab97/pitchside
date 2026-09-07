import { useQuery } from '@tanstack/react-query'
import { endOfDay, startOfDay } from 'date-fns'
import { supabase } from '@/shared/lib/supabase'
import { minutesOfDay } from '@/shared/lib/tz'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { parseRange } from '@/shared/lib/range'

/**
 * Legge la vista pubblica `busy_slots`, non la tabella `bookings`: funziona
 * anche senza account. La vista espone solo struttura, campo e intervallo —
 * niente su chi ha prenotato o a quanto — e questo hook non chiede altro.
 */
export function useAvailability(day: Date, fieldId: string | null) {
  const facility = useFacility()

  const { data, isPending, error } = useQuery({
    queryKey: ['busy', facility.id, fieldId, startOfDay(day).toISOString()],
    enabled: !!fieldId,
    queryFn: async (): Promise<[number, number][]> => {
      const { data, error } = await supabase
        .from('busy_slots')
        .select('slot')
        .eq('facility_id', facility.id)
        .eq('field_id', fieldId!)
        .overlaps('slot', `[${startOfDay(day).toISOString()},${endOfDay(day).toISOString()})`)
      if (error) throw error
      return data.map((r) => {
        const [s, e] = parseRange(r.slot as unknown as string)
        // una prenotazione che finisce a mezzanotte vale 1440, non 0
        const end = minutesOfDay(e) === 0 ? 1440 : minutesOfDay(e)
        return [minutesOfDay(s), end] as [number, number]
      })
    },
  })

  return { busy: data ?? [], isPending, error }
}

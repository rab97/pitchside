import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { dayKey } from '@/shared/lib/tz'

/**
 * Il prezzo di ogni partenza possibile di una giornata, in una sola
 * richiesta: chiama la RPC pubblica `slot_prices`
 * (supabase/migrations/0014_slot_prices.sql), che internamente usa
 * `calc_booking_price` — la stessa unica verità sul prezzo del database.
 *
 * Funziona anche senza account: `slot_prices` è concessa ad `anon`.
 *
 * L'insieme delle chiavi della mappa *è* l'orario apribile del campo per
 * quel giorno — ricavato dalle `price_bands`, non da una costante nel
 * codice: vedi il commento in cima alla migrazione.
 */
export function useSlotPrices(day: Date, fieldId: string | null, durationMinutes: number) {
  const { data, isPending, error } = useQuery({
    queryKey: ['slot-prices', fieldId, dayKey(day), durationMinutes],
    enabled: !!fieldId,
    queryFn: async (): Promise<Map<number, number>> => {
      const { data, error } = await supabase.rpc('slot_prices', {
        p_field_id: fieldId!,
        p_day: dayKey(day),
        p_duration_minutes: durationMinutes,
      })
      if (error) throw error
      return new Map(data.map((r) => [r.start_min, r.price_cents]))
    },
  })

  return { prices: data ?? new Map<number, number>(), isPending, error }
}

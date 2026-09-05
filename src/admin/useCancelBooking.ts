import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

/**
 * La disdetta è tardiva quando arriva dopo la scadenza scritta sulla
 * prenotazione. Il calcolo che conta è quello del database (`cancel_booking`
 * incrementa `missed_count`): questa funzione serve a dirlo al gestore
 * *prima* che prema, non a decidere.
 */
export function isLateCancel(deadline: Date, now: Date): boolean {
  return now > deadline
}

export function useCancelBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('cancel_booking', {
        p_booking_id: id,
        p_reason: reason ?? undefined,
      })
      if (error) throw new Error('La disdetta non è riuscita. Riprova.')
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  })
}

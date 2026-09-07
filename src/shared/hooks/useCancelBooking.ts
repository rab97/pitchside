import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'

/**
 * La disdetta è tardiva quando arriva dopo la scadenza scritta sulla
 * prenotazione. Il calcolo che conta è quello del database (`cancel_booking`
 * incrementa `missed_count`): questa funzione serve a dirlo prima che si
 * prema conferma, non a decidere.
 */
export function isLateCancel(deadline: Date, now: Date): boolean {
  return now > deadline
}

/**
 * L'errore di `cancel_booking`, col codice SQLSTATE ancora leggibile in
 * `code`. Questo gancio serve sia il gestore sia il cliente, e i due
 * leggono frasi diverse per lo stesso codice — al gestore cosa è successo,
 * al cliente cosa fare adesso — quindi la traduzione non può stare qui:
 * vive in `messageForError` (admin) e `messageForCustomer` (booking), a
 * fianco di chi la usa.
 */
export class CancelBookingError extends Error {
  code: string
  constructor(code: string) {
    super(code)
    this.code = code
  }
}

export function useCancelBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason?: string }) => {
      const { data, error } = await supabase.rpc('cancel_booking', {
        p_booking_id: id,
        p_reason: reason ?? undefined,
      })
      if (error) throw new CancelBookingError(error.code ?? '')
      return data
    },
    onSuccess: () => {
      // 'bookings' serve la griglia del gestore, 'my-bookings' lo storico
      // del cliente, 'busy' la disponibilità su /prenota: la stessa
      // disdetta deve liberare lo slot in entrambe le viste.
      qc.invalidateQueries({ queryKey: ['bookings'] })
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
      qc.invalidateQueries({ queryKey: ['busy'] })
    },
  })
}

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { slotRange } from '@/shared/lib/tz'

// Stessi codici del gestore (src/features/admin/hooks/useCreateBooking.ts),
// frasi diverse: chi sta al telefono con un cliente deve sapere cosa è
// successo, chi sta prenotando da solo deve sapere cosa fare adesso.
const MESSAGES: Record<string, string> = {
  PS003: 'Il campo è chiuso in quell’orario.',
  PS004: 'Qualcuno ha appena preso questo slot. Scegline un altro.',
  PS005: 'A quell’ora l’impianto è chiuso.',
  PS006: 'Quell’orario è già passato.',
  PS007: 'Non si può ancora prenotare così avanti nel tempo.',
  PS008: 'La durata è inferiore al minimo consentito.',
  PS012: 'Devi accedere per prenotare.',
  PS013: 'Non puoi prenotare a nome di un altro.',
}

export function messageForCustomer(code: string): string {
  return MESSAGES[code] ?? 'La prenotazione non è riuscita. Riprova.'
}

export type CustomerBooking = {
  fieldId: string
  day: string
  startMin: number
  minutes: number
  memberId: string
}

export function useBookAsMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: CustomerBooking) => {
      const { data, error } = await supabase.rpc('create_booking', {
        p_field_id: input.fieldId,
        p_slot: slotRange(input.day, input.startMin, input.minutes),
        p_member_id: input.memberId,
        // Il database lo forza comunque a 'app' per chi non è gestore:
        // qui è solo esplicito, non è lì che si difende.
        p_source: 'app',
      })
      if (error) throw new Error(messageForCustomer(error.code ?? ''))
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['busy'] })
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
    },
  })
}

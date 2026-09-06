import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { slotRange } from '../lib/tz'

// Le chiavi sono gli SQLSTATE alzati dalle funzioni plpgsql: PostgREST li
// restituisce tali e quali in `error.code`. Il messaggio del database è già
// in italiano, ma qui diventa una frase che dice al gestore cosa fare.
const MESSAGES: Record<string, string> = {
  PS002: 'Il campo non è disponibile.',
  PS003: 'Il campo è chiuso in quell’orario.',
  PS004: 'Questo slot è appena stato prenotato da qualcun altro. Scegline un altro.',
  PS005: 'Non c’è una tariffa per quell’orario: il campo è fuori apertura.',
  PS006: 'Non si può prenotare nel passato.',
  PS007: 'La data è troppo lontana: supera l’orizzonte di prenotazione.',
  PS008: 'La durata è inferiore al minimo consentito.',
  PS012: 'Devi accedere per prenotare.',
  PS013: 'Non puoi prenotare a nome di un altro.',
}

export function messageForError(code: string): string {
  return MESSAGES[code] ?? 'La prenotazione non è riuscita. Riprova.'
}

export type NewBooking = {
  fieldId: string
  day: string          // 'yyyy-MM-dd' nel fuso della struttura
  startMin: number
  minutes: number
  memberId: string
  source?: 'phone' | 'app' | 'admin'
}

export function useCreateBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewBooking) => {
      const { data, error } = await supabase.rpc('create_booking', {
        p_field_id: input.fieldId,
        p_slot: slotRange(input.day, input.startMin, input.minutes),
        p_member_id: input.memberId,
        p_source: input.source ?? 'phone',
      })
      if (error) throw new Error(messageForError(error.code ?? ''))
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  })
}

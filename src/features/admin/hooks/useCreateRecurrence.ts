import { useMutation, useQueryClient } from '@tanstack/react-query'
import { getISODay } from 'date-fns'
import { supabase } from '@/shared/lib/supabase'
import { dayKey } from '@/shared/lib/tz'

export type NewRecurrence = {
  facilityId: string
  fieldId: string
  memberId: string
  day: Date
  startMin: number
  minutes: number
  until: string           // 'yyyy-MM-dd'
}

export type RecurrenceResult = {
  created: number
  skipped: number
  skipped_dates: string[]
}

/**
 * Due passaggi, non uno: prima la regola, poi le occorrenze. Le occorrenze
 * sono prenotazioni vere — ognuna cancellabile e spostabile da sola — e
 * generate_recurrence restituisce anche le date che ha dovuto saltare perché
 * il campo era già occupato. Quelle vanno mostrate: senza, il gestore crede di
 * aver bloccato la stagione e scopre il buco a gennaio.
 */
export function useCreateRecurrence() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: NewRecurrence): Promise<RecurrenceResult> => {
      const { data: rec, error: recError } = await supabase
        .from('recurrences')
        .insert({
          facility_id: input.facilityId,
          field_id: input.fieldId,
          member_id: input.memberId,
          weekday: getISODay(input.day),
          start_min: input.startMin,
          duration_minutes: input.minutes,
          from_date: dayKey(input.day),
          to_date: input.until,
        })
        .select('id')
        .single()
      if (recError) throw new Error('Non è stato possibile creare la ricorrenza.')

      const { data, error } = await supabase.rpc('generate_recurrence', {
        p_recurrence_id: rec.id,
      })
      if (error) throw new Error('Le date della ricorrenza non sono state generate.')

      const row = Array.isArray(data) ? data[0] : data
      return {
        created: row?.created ?? 0,
        skipped: row?.skipped ?? 0,
        skipped_dates: row?.skipped_dates ?? [],
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  })
}

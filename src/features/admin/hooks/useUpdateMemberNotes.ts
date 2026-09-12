import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { memberMessage } from '../utils/memberMessages'

/**
 * L'unica scrittura possibile dalla scheda. Le note si salvano uscendo dal
 * campo e anche se la prenotazione poi non si fa: riguardano la persona, non
 * l'appuntamento.
 */
export function useUpdateMemberNotes(): {
  saveNotes: (memberId: string, notes: string) => Promise<void>
  saving: boolean
  saveError: string | null
} {
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({ memberId, notes }: { memberId: string; notes: string }) => {
      const trimmed = notes.trim()
      // `select()` dopo la `update`: una scrittura esclusa dalla clausola
      // `using` di RLS non corrisponde a nessuna riga e NON restituisce
      // errore. Senza la riga indietro, «non ho scritto niente» e «ho scritto»
      // sono indistinguibili.
      const { data, error } = await supabase
        .from('members')
        .update({ notes: trimmed === '' ? null : trimmed })
        .eq('id', memberId)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('nessuna riga aggiornata')
      return memberId
    },
    onSuccess: (memberId) => {
      qc.invalidateQueries({ queryKey: ['member-card', memberId] })
    },
  })

  return {
    saveNotes: async (memberId: string, notes: string) => {
      await mutation.mutateAsync({ memberId, notes })
    },
    saving: mutation.isPending,
    saveError: mutation.error ? memberMessage(mutation.error, 'save') : null,
  }
}

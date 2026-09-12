import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { memberMessage } from '../utils/memberMessages'

/**
 * The one write the card can make. Notes save on leaving the field, and they
 * save even if the booking is then abandoned: they are about the person, not
 * about the appointment.
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
      // `select()` after the `update`: a write excluded by an RLS `using`
      // clause matches no row and returns NO error. Without asking for the
      // row back, "I wrote nothing" and "I wrote" are indistinguishable, and
      // the manager would be told a note was saved that never was.
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

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { digitsOf } from '../utils/memberKeys'

/**
 * The deliberate creation. No heuristic inserts a card on its own any more:
 * this is the single place a customer is born, and it costs an explicit
 * gesture because it is the single moment duplicates are born with them.
 *
 * The collision error is rethrown exactly as it arrived, `code` and all: only
 * the caller knows whether to show it as a question («is this the one?») or as
 * a message. Translating it here would take that choice away and leave the
 * caller matching on a sentence.
 */
export function useCreateMember(): {
  createMember: (input: { name: string; phone: string }) => Promise<string>
  creating: boolean
} {
  const facility = useFacility()
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({ name, phone }: { name: string; phone: string }) => {
      const digits = digitsOf(phone)
      const { data, error } = await supabase
        .from('members')
        .insert({
          facility_id: facility.id,
          name: name.trim(),
          phone: digits === '' ? null : digits,
        })
        .select('id')
        .single()
      if (error) throw error
      if (!data) throw new Error('nessuna riga creata')
      return data.id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['member-search', facility.id] })
    },
  })

  return {
    createMember: (input: { name: string; phone: string }) => mutation.mutateAsync(input),
    creating: mutation.isPending,
  }
}

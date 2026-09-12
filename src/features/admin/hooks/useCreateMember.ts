import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'

/**
 * La creazione deliberata. Non c'è più nessuna euristica che inserisca una
 * scheda per conto suo: è l'unico punto in cui nasce un cliente, e costa un
 * gesto esplicito perché è l'unico momento in cui nascono i doppioni.
 *
 * L'errore di collisione viene rilanciato così com'è, con il suo `code`: solo
 * il chiamante sa se mostrarlo come domanda («è questo?») o come messaggio.
 */
export function useCreateMember(): {
  createMember: (input: { name: string; phone: string }) => Promise<string>
  creating: boolean
} {
  const facility = useFacility()
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: async ({ name, phone }: { name: string; phone: string }) => {
      const digits = phone.replace(/\D/g, '')
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

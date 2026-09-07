import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { useFacility } from '@/shared/tenant/FacilityProvider'

/** La scheda dell'utente in questa struttura. Null se non ha fatto accesso. */
export function useMyMember() {
  const { session } = useAuth()
  const facility = useFacility()

  const { data, isPending, error } = useQuery({
    queryKey: ['my-member', facility.id, session?.user.id],
    enabled: !!session,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ensure_my_member', {
        p_facility: facility.id,
      })
      if (error) throw error
      return data as string
    },
  })

  // L'errore non si butta: è `ensure_my_member` a fallire, e quando fallisce
  // «Conferma» resta disabilitata e /prenotazioni resta in caricamento senza
  // che niente dica perché.
  return { memberId: data ?? null, isPending: !!session && isPending, error }
}

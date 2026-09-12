import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'

export type MemberHit = {
  id: string
  name: string
  phone: string | null
  hasMissed: boolean
}

/** Below two characters this would match half the address book: no query is sent. */
const MIN_QUERY = 2

/**
 * The search that runs on every keystroke. The order is not touched here: it
 * arrives already decided by `search_members`, where pgTAP proves it case by
 * case. Re-sorting on the client would mean having two rules, and the second
 * one is the one nobody notices has drifted.
 */
export function useMemberSearch(query: string): {
  results: MemberHit[]
  isPending: boolean
  failed: boolean
} {
  const facility = useFacility()
  const q = query.trim()
  const enabled = q.length >= MIN_QUERY

  const { data, isPending, error } = useQuery({
    queryKey: ['member-search', facility.id, q],
    enabled,
    // The manager is on the phone: an answer from half a second ago is still
    // good, and redoing it on every keystroke would not change what it reads.
    staleTime: 30_000,
    retry: false,
    queryFn: async (): Promise<MemberHit[]> => {
      const { data, error } = await supabase.rpc('search_members', {
        p_facility: facility.id,
        p_query: q,
      })
      if (error) throw error
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        phone: r.phone,
        hasMissed: r.has_missed,
      }))
    },
  })

  return {
    results: data ?? [],
    isPending: enabled && isPending,
    failed: !!error,
  }
}

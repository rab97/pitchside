import { useEffect, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'

export type MemberHit = {
  id: string
  name: string
  phone: string | null
  hasMissed: boolean
}

/**
 * Below two characters this would match half the address book: no query is
 * sent. Exported because the «Nuovo cliente» gesture has to use the same
 * number — two thresholds meant the button appeared at one character and the
 * results at two, so typing a name produced two separate layout steps.
 */
export const MIN_QUERY = 2

/**
 * How long the typing has to stop before the query fires. A manager types a
 * full name faster than the network answers: without this, «Rossi Luca» is
 * eight requests of which seven are stale before they land. Long enough to
 * swallow a burst of keys, short enough that a manager who has stopped typing
 * does not notice waiting — the answer still arrives while they are reading
 * the name back to the caller.
 */
const DEBOUNCE_MS = 200

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
  const typed = query.trim()
  // Starts empty rather than at `typed`, so the first keystroke waits for the
  // same pause every later one does. The field this serves opens empty
  // anyway, which makes the two identical in the only case that runs.
  const [q, setQ] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setQ(typed), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [typed])

  const enabled = q.length >= MIN_QUERY

  const { data, isPending, error } = useQuery({
    queryKey: ['member-search', facility.id, q],
    enabled,
    // Each keystroke is a new query key, and without this `data` is undefined
    // for it until the answer lands: `results` fell back to `[]`, the results
    // list unmounted and remounted once per character, and the dialog jumped
    // under the manager's hands while they typed. Showing the previous
    // answer for the fraction of a second the next one takes is both calmer
    // and more useful than showing nothing.
    placeholderData: keepPreviousData,
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
    // `enabled` guards the placeholder too: `keepPreviousData` would otherwise
    // keep handing back the last answer after the field has been emptied, and
    // a list of names under a blank field is worse than the flicker this was
    // meant to cure.
    results: enabled ? (data ?? []) : [],
    isPending: enabled && isPending,
    failed: !!error,
  }
}

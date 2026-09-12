import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility, type Facility } from '@/shared/tenant/FacilityProvider'

export type FacilityPatch = Partial<Pick<Facility,
  'name' | 'color' | 'phone' | 'address' |
  'cancel_hours' | 'booking_horizon_days' | 'slot_minutes' | 'min_duration_minutes'>>

/**
 * The one sentence this failure is said in. Exported because `FacilityPage`
 * shows it too, and two copies of a message drift.
 */
export const SAVE_FAILED_MESSAGE = 'Non siamo riusciti a salvare le impostazioni. Riprova.'

/**
 * Writes straight to `facilities`: the `facilities_write_admin` policy is the
 * authorization, and putting a function in front of it would only move the
 * same check somewhere less reliable.
 */
export function useUpdateFacility() {
  const facility = useFacility()
  const qc = useQueryClient()

  const m = useMutation({
    mutationFn: async (patch: FacilityPatch) => {
      // An `UPDATE` whose `USING` clause excludes the target row — a stale
      // session, a revoked admin, a mismatched facility id — matches zero
      // rows and PostgREST reports no error for that. Asking for the row
      // back is what tells a real write from a silent no-op: `error` alone
      // is not enough.
      const { data, error } = await supabase
        .from('facilities')
        .update(patch)
        .eq('id', facility.id)
        .select('id')
        .single()
      if (error || !data) throw new Error(SAVE_FAILED_MESSAGE)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facility'] }),
  })

  // `saving`/`saveError`, not `isPending`/`error`: every sibling hook here
  // returns those two names for a *query* — "the load is running", "the load
  // failed" — and this one has no query at all. A reader arriving from
  // `PriceBandsPage` would otherwise read "we could not load this" where the
  // code means "we could not save it".
  return { save: m.mutateAsync, saving: m.isPending, saveError: m.error }
}

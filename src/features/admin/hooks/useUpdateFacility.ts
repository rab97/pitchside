import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility, type Facility } from '@/shared/tenant/FacilityProvider'

export type FacilityPatch = Partial<Pick<Facility,
  'name' | 'color' | 'phone' | 'address' |
  'cancel_hours' | 'booking_horizon_days' | 'slot_minutes' | 'min_duration_minutes'>>

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
      const { error } = await supabase
        .from('facilities')
        .update(patch)
        .eq('id', facility.id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['facility'] }),
  })

  return { save: m.mutateAsync, isPending: m.isPending, error: m.error }
}

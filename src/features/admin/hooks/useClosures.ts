import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { parseRange } from '@/shared/lib/range'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { splitClosures } from '../utils/splitClosures'

export type Closure = {
  id: string
  field_id: string | null
  field_name: string | null
  starts_at: Date
  ends_at: Date
  reason: string | null
}

type ClosureRow = {
  id: string
  field_id: string | null
  period: unknown
  reason: string | null
  fields: { name: string } | null
}

export type NewClosure = {
  fieldId: string | null
  from: Date
  to: Date
  reason: string
}

/**
 * A facility's closures, split into upcoming and past, plus the one write
 * this screen offers on top of `create_closure`: removing one. Deleting a
 * closure does not touch the bookings `create_closure` already cancelled —
 * it only reopens the period, which is exactly what `ClosuresPage` tells the
 * manager before they confirm.
 */
export function useClosures() {
  const facility = useFacility()
  const qc = useQueryClient()
  const queryKey = ['closures', facility.id]

  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<Closure[]> => {
      const { data, error } = await supabase
        .from('closures')
        .select('id, field_id, period, reason, fields(name)')
        .eq('facility_id', facility.id)
      if (error) throw error
      return (data as unknown as ClosureRow[]).map((r) => {
        const [starts_at, ends_at] = parseRange(r.period as unknown as string)
        return {
          id: r.id,
          field_id: r.field_id,
          field_name: r.fields?.name ?? null,
          starts_at,
          ends_at,
          reason: r.reason,
        }
      })
    },
  })

  const { upcoming, past } = splitClosures(data ?? [], new Date())

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      // Same hazard as every other write in this feature: an RLS `using`
      // clause that excludes the row matches zero rows and PostgREST reports
      // no error for it — asking for the row back is what tells a real
      // delete from a silent no-op.
      const { data, error } = await supabase.from('closures').delete().eq('id', id).select('id')
      if (error) throw error
      if (!data || data.length === 0) throw new Error('L’eliminazione non ha rimosso alcuna riga.')
    },
    // Only this list. Deleting a closure reopens the period and restores
    // nothing: the bookings `create_closure` cancelled stay cancelled — it
    // is what `ClosuresPage` promises the manager before they confirm — so
    // `bookings`, `busy_slots` and the conflict preview all still hold what
    // they held. Invalidating them here would be noise, not correctness.
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  })

  // Unlike the read above and the delete below, this is a real RPC: closing
  // and cancelling have to happen in one transaction, and `bookings` is
  // writable only through it. It returns how many bookings it cancelled — an
  // error from it is a real error, not the silent-no-op shape the delete
  // above has to guard against.
  const createMutation = useMutation({
    mutationFn: async (input: NewClosure): Promise<number> => {
      const { data, error } = await supabase.rpc('create_closure', {
        p_facility_id: facility.id,
        // The generated type has `p_field_id` as a non-nullable `string`,
        // because Postgres exposes no per-parameter nullability to the
        // generator. A whole-facility closure still requires passing null —
        // the cast here is what lets the UI say so.
        p_field_id: input.fieldId as unknown as string,
        p_period: `[${input.from.toISOString()},${input.to.toISOString()})`,
        p_reason: input.reason,
      })
      if (error) throw error
      return data ?? 0
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
      // This write cancels bookings, so every query that reads a booking is
      // now answering with rows that no longer exist as it describes them.
      // There are four, and they belong to four different screens:
      // the day grid must stop showing what was just cancelled…
      qc.invalidateQueries({ queryKey: ['bookings', facility.id] })
      // …the customer's own list must show it as cancelled, because it is
      // the customer whose match was just called off — keyed
      // ['my-bookings', facilityId, memberId] in
      // `src/features/booking/hooks/useMyBookings.ts`, so this prefix
      // matches whichever member is signed in. `useCancelBooking` already
      // invalidates it for the very same event; a closure cancels through
      // `create_closure` instead, and reaches the same rows…
      qc.invalidateQueries({ queryKey: ['my-bookings', facility.id] })
      // …the customer's availability on `/prenota` must free those slots —
      // `busy_slots` is a view over `bookings where status = 'active'`
      // (`supabase/migrations/0007_busy_slots.sql`), read under
      // ['busy', facilityId, fieldId, day] in
      // `src/features/booking/hooks/useAvailability.ts`, and the panel and
      // `/prenota` share one QueryClient…
      qc.invalidateQueries({ queryKey: ['busy', facility.id] })
      // …and the conflict preview, keyed by period, would otherwise offer
      // its cached answer again if the manager reopened this dialog over
      // the same period, listing bookings this very call cancelled.
      qc.invalidateQueries({ queryKey: ['closure-conflicts', facility.id] })
    },
  })

  return {
    upcoming,
    past,
    isPending,
    error,
    create: createMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
  }
}

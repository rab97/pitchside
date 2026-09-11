import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'

export type AdminField = {
  id: string
  name: string
  kind: string
  surface: string
  covered: boolean
  active: boolean
  sort_order: number
  booking_count: number
}

type FieldRowWithCount = {
  id: string
  name: string
  kind: string
  surface: string
  covered: boolean
  active: boolean
  sort_order: number
  bookings: { count: number }[] | null
}

/**
 * The manager's view of the facility's pitches. It differs from
 * `@/shared/hooks/useFields` — the customer-facing query — in the two ways
 * this screen needs: it returns inactive pitches too, because a manager has
 * to see a deactivated one in order to reactivate it, and it carries
 * `surface`, `active` and a booking count, because the screen has to decide
 * whether deleting a pitch is even offered.
 */
export function useAdminFields() {
  const facility = useFacility()
  const qc = useQueryClient()
  const queryKey = ['admin-fields', facility.id]

  const { data, isPending, error } = useQuery({
    queryKey,
    queryFn: async (): Promise<AdminField[]> => {
      const { data, error } = await supabase
        .from('fields')
        .select('id, name, kind, surface, covered, active, sort_order, bookings(count)')
        .eq('facility_id', facility.id)
        .order('sort_order')
      if (error) throw error
      return (data as unknown as FieldRowWithCount[]).map((r) => ({
        id: r.id,
        name: r.name,
        kind: r.kind,
        surface: r.surface,
        covered: r.covered,
        active: r.active,
        sort_order: r.sort_order,
        booking_count: r.bookings?.[0]?.count ?? 0,
      }))
    },
  })

  // The customer-facing list must not keep showing a pitch the manager just
  // deactivated (or hide one just reactivated), so every write here
  // invalidates that query's key too.
  function invalidate() {
    qc.invalidateQueries({ queryKey })
    qc.invalidateQueries({ queryKey: ['fields', facility.id] })
  }

  const createMutation = useMutation({
    mutationFn: async (input: Omit<AdminField, 'id' | 'booking_count'>) => {
      // A row an RLS `with check` clause excludes matches zero rows and
      // PostgREST reports no error for it: asking for the row back is what
      // tells a real write from a silent no-op.
      const { data, error } = await supabase
        .from('fields')
        .insert({ ...input, facility_id: facility.id })
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('L’inserimento non ha restituito alcuna riga.')
      return data
    },
    onSuccess: invalidate,
  })

  const updateMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<AdminField> }) => {
      // `booking_count` is a computed value from the embedded `bookings`
      // relation, not a real column — strip it before it reaches the table.
      const { booking_count: _bookingCount, ...columns } = patch
      const { data, error } = await supabase
        .from('fields')
        .update(columns)
        .eq('id', id)
        .select('id')
        .single()
      if (error || !data) throw error ?? new Error('L’aggiornamento non ha modificato alcuna riga.')
      return data
    },
    onSuccess: invalidate,
  })

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('fields')
        .delete()
        .eq('id', id)
        .select('id')
      if (error) throw error
      // Same hazard as the other two mutations: a delete an RLS policy
      // excludes, or one that simply matches nothing, comes back with no
      // error and an empty array — reporting that as a success would be the
      // same silent lie.
      if (!data || data.length === 0) throw new Error('L’eliminazione non ha rimosso alcuna riga.')
    },
    onSuccess: invalidate,
  })

  const reorderMutation = useMutation({
    mutationFn: async (patches: { id: string; sort_order: number }[]) => {
      // One request per row, each held to the same standard as every other
      // write here: a row an RLS policy excludes, or one that simply matches
      // nothing, comes back with no error — asking for the row back is what
      // catches that.
      await Promise.all(
        patches.map(async (patch) => {
          const { data, error } = await supabase
            .from('fields')
            .update({ sort_order: patch.sort_order })
            .eq('id', patch.id)
            .select('id')
            .single()
          if (error || !data) throw error ?? new Error('Il riordino non ha modificato alcuna riga.')
        }),
      )
    },
    // Whether the drag persisted or not, the list on screen must end up
    // showing what the database actually holds — never the order the finger
    // left behind. A failed write still invalidates so a partial write
    // (some rows renumbered, some not) surfaces instead of hiding.
    onSuccess: invalidate,
    onError: invalidate,
  })

  return {
    fields: data ?? [],
    isPending,
    error,
    create: createMutation.mutateAsync,
    update: (id: string, patch: Partial<AdminField>) => updateMutation.mutateAsync({ id, patch }),
    remove: removeMutation.mutateAsync,
    reorderFields: reorderMutation.mutateAsync,
  }
}

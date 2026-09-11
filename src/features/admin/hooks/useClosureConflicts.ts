import { useQuery } from '@tanstack/react-query'
import { parseRange } from '@/shared/lib/range'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'

export type ClosureConflict = {
  id: string
  field_id: string
  slot_start: Date
  slot_end: Date
  member_name: string
  member_phone: string | null
  price_cents: number
}

type ConflictRow = {
  id: string
  field_id: string
  slot: unknown
  price_cents: number
  members: { name: string; phone: string | null } | null
}

/**
 * The closure preview: what `create_closure` would cancel, read directly —
 * not through an RPC — because a manager can already see their own
 * facility's active bookings via RLS (`bookings_read_admin`), and only the
 * write that cancels them needs the elevated privileges `create_closure`
 * carries. Disabled until a period is chosen, so opening the dialog does not
 * fire a query against an empty range.
 */
export function useClosureConflicts(
  fieldId: string | null,
  period: { from: Date; to: Date } | null,
) {
  const facility = useFacility()

  const { data, isPending, error } = useQuery({
    queryKey: [
      'closure-conflicts',
      facility.id,
      fieldId,
      period?.from.toISOString() ?? null,
      period?.to.toISOString() ?? null,
    ],
    enabled: !!period,
    queryFn: async (): Promise<ClosureConflict[]> => {
      const { from, to } = period as { from: Date; to: Date }
      let query = supabase
        .from('bookings')
        .select('id, slot, price_cents, field_id, members(name, phone)')
        .eq('facility_id', facility.id)
        .eq('status', 'active')
        .overlaps('slot', `[${from.toISOString()},${to.toISOString()})`)
      if (fieldId) query = query.eq('field_id', fieldId)

      const { data, error } = await query
      if (error) throw error
      return (data as unknown as ConflictRow[]).map((r) => {
        const [slot_start, slot_end] = parseRange(r.slot as unknown as string)
        return {
          id: r.id,
          field_id: r.field_id,
          slot_start,
          slot_end,
          member_name: r.members?.name ?? '—',
          member_phone: r.members?.phone ?? null,
          price_cents: r.price_cents,
        }
      })
    },
  })

  return { conflicts: data ?? [], isPending, error }
}

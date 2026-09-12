import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'

export type MemberCardData = {
  id: string
  name: string
  phone: string | null
  email: string | null
  priceList: string
  notes: string | null
  appearances: number
  missed: number
  lastPlayed: Date | null
  usualFieldName: string | null
}

/**
 * The card opens once per selection, not on every keystroke: that is why it
 * is separate from `useMemberSearch` and can afford the history aggregates.
 *
 * `member_card` filters on `is_facility_admin` itself (see 0021_member_card.sql):
 * a caller who is not an admin of that member's facility gets zero rows back,
 * not an error. That case reads here as `card: null`, same as "nothing
 * selected yet" — it is not a failure, so it must not set `failed`.
 */
export function useMemberCard(memberId: string | null): {
  card: MemberCardData | null
  isPending: boolean
  failed: boolean
} {
  const { data, isPending, error } = useQuery({
    queryKey: ['member-card', memberId],
    enabled: !!memberId,
    retry: false,
    queryFn: async (): Promise<MemberCardData | null> => {
      const { data, error } = await supabase.rpc('member_card', {
        p_member_id: memberId!,
      })
      if (error) throw error
      const row = (data ?? [])[0]
      if (!row) return null
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        email: row.email,
        priceList: row.price_list,
        notes: row.notes,
        appearances: row.appearances,
        missed: row.missed,
        lastPlayed: row.last_played ? new Date(row.last_played) : null,
        usualFieldName: row.usual_field_name,
      }
    },
  })

  return {
    card: data ?? null,
    isPending: !!memberId && isPending,
    failed: !!error,
  }
}

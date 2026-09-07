import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'

export type FieldRow = {
  id: string
  name: string
  kind: string
  covered: boolean
  sort_order: number
}

export function useFields(): FieldRow[] {
  const facility = useFacility()
  const { data } = useQuery({
    queryKey: ['fields', facility.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<FieldRow[]> => {
      const { data, error } = await supabase
        .from('fields')
        .select('id, name, kind, covered, sort_order')
        .eq('facility_id', facility.id)
        .eq('active', true)
        .order('sort_order')
      if (error) throw error
      return data
    },
  })
  return data ?? []
}

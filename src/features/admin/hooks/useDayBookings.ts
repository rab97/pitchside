import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { endOfDay, startOfDay } from 'date-fns'
import { parseRange } from '@/shared/lib/range'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useFields } from './useFields'

export type BookingRow = {
  id: string
  field_id: string
  member_id: string
  member_name: string
  member_phone: string | null
  slot_start: Date
  slot_end: Date
  source: string
  price_cents: number
  status: string
  cancel_deadline: string
}

export function useDayBookings(day: Date) {
  const facility = useFacility()
  const qc = useQueryClient()
  const fields = useFields()

  const bookingsQ = useQuery({
    queryKey: ['bookings', facility.id, startOfDay(day).toISOString()],
    queryFn: async (): Promise<BookingRow[]> => {
      const { data, error } = await supabase
        .from('bookings')
        // Colonne esplicite: `members.notes` è una nota interna e non deve
        // finire in nessuna risposta oltre a quelle che la richiedono.
        .select('id, field_id, member_id, slot, source, price_cents, status, cancel_deadline, members(name, phone)')
        .eq('facility_id', facility.id)
        .eq('status', 'active')
        .overlaps('slot', `[${startOfDay(day).toISOString()},${endOfDay(day).toISOString()})`)
      if (error) throw error
      return data.map((r): BookingRow => {
        const [s, e] = parseRange(r.slot as unknown as string)
        const member = r.members as { name: string; phone: string | null } | null
        return {
          id: r.id,
          field_id: r.field_id,
          member_id: r.member_id,
          member_name: member?.name ?? '—',
          member_phone: member?.phone ?? null,
          slot_start: s,
          slot_end: e,
          source: r.source,
          price_cents: r.price_cents,
          status: r.status,
          cancel_deadline: r.cancel_deadline,
        }
      })
    },
  })

  // Si invalida la query invece di applicare al volo la riga che arriva dal
  // canale: quella non passa dalle stesse policy della select, e ricaricare
  // una giornata di prenotazioni costa poco.
  useEffect(() => {
    const channel = supabase
      .channel(`bookings-${facility.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bookings',
          filter: `facility_id=eq.${facility.id}` },
        () => qc.invalidateQueries({ queryKey: ['bookings', facility.id] }))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [facility.id, qc])

  return {
    fields,
    bookings: bookingsQ.data ?? [],
    isPending: bookingsQ.isPending,
  }
}

import { useQuery } from '@tanstack/react-query'
import { parseRange } from '@/shared/lib/range'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { splitBookings } from '../utils/splitBookings'

export type MyBooking = {
  id: string
  field_name: string
  field_kind: string
  slot_start: Date
  slot_end: Date
  status: string
  price_cents: number
  cancel_deadline: string
}

/**
 * Le prenotazioni di chi ha fatto accesso, future e passate.
 *
 * Nessun filtro sull'utente nella query: la policy `bookings_read_own` fa già
 * il lavoro, una `select` senza condizioni restituisce solo le proprie righe.
 * Aggiungere qui un `.eq('member_id', ...)` duplicherebbe nel client una
 * regola che vive nel database.
 *
 * Il filtro su `facility_id` che resta è un'altra cosa: non riguarda
 * l'appartenenza (quella la fa la RLS), ma il fatto che lo stesso numero di
 * telefono può essere cliente di più strutture (`members_facility_phone_uniq`
 * è per struttura, non globale) — questa pagina vive sul dominio di una sola
 * e non deve mostrare lo storico delle altre.
 */
export function useMyBookings() {
  const facility = useFacility()
  const { session } = useAuth()

  const { data, isPending } = useQuery({
    queryKey: ['my-bookings', facility.id, session?.user.id],
    enabled: !!session,
    queryFn: async (): Promise<MyBooking[]> => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, slot, status, price_cents, cancel_deadline, fields(name, kind)')
        .eq('facility_id', facility.id)
        .order('slot', { ascending: false })
      if (error) throw error
      return data.map((r): MyBooking => {
        const [slot_start, slot_end] = parseRange(r.slot as unknown as string)
        const field = r.fields as { name: string; kind: string } | null
        return {
          id: r.id,
          field_name: field?.name ?? '—',
          field_kind: field?.kind ?? '',
          slot_start,
          slot_end,
          status: r.status,
          price_cents: r.price_cents,
          cancel_deadline: r.cancel_deadline,
        }
      })
    },
  })

  const { future, past } = splitBookings(data ?? [], new Date())

  return { future, past, isPending: session ? isPending : false }
}

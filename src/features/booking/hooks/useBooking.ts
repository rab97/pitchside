import { useQuery } from '@tanstack/react-query'
import { parseRange } from '@/shared/lib/range'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { useMyMember } from '@/features/auth/hooks/useMyMember'

export type BookingDetail = {
  id: string
  field_name: string
  field_kind: string
  slot_start: Date
  slot_end: Date
  status: string
  price_cents: number
  cancel_deadline: Date
}

/**
 * Il dettaglio di una prenotazione, per la pagina che il cliente apre da
 * `/prenotazioni/:id`.
 *
 * Il filtro su `member_id` qui non è un doppione della RLS, è l'unica cosa
 * che sta fra "non esiste" e "è di un altro" (vedi il commento in
 * `useMyBookings.ts`): `bookings_read_own` OR `bookings_read_admin` si
 * sommano, quindi un cliente che è anche gestore potrebbe leggere via RLS
 * la riga di chiunque nella struttura. Interrogare per solo `id` mostrerebbe
 * a quell'utente — in una pagina che promette "la tua prenotazione" — il
 * dettaglio della prenotazione di un altro cliente. Filtrando anche su
 * `member_id`, una riga che esiste ma non è sua semplicemente non torna:
 * la pagina la tratta come inesistente, senza rivelare che c'è.
 */
export function useBooking(id: string | undefined) {
  const facility = useFacility()
  const { session } = useAuth()
  const { memberId, isPending: memberPending, error: memberError } = useMyMember()

  const { data, isPending, error } = useQuery({
    queryKey: ['my-booking', facility.id, memberId, id],
    enabled: !!session && !!memberId && !!id,
    queryFn: async (): Promise<BookingDetail | null> => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, slot, status, price_cents, cancel_deadline, fields(name, kind)')
        .eq('facility_id', facility.id)
        .eq('member_id', memberId as string)
        .eq('id', id as string)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const [slot_start, slot_end] = parseRange(data.slot as unknown as string)
      const field = data.fields as { name: string; kind: string } | null
      return {
        id: data.id,
        field_name: field?.name ?? '—',
        field_kind: field?.kind ?? '',
        slot_start,
        slot_end,
        status: data.status,
        price_cents: data.price_cents,
        cancel_deadline: new Date(data.cancel_deadline),
      }
    },
  })

  return {
    booking: data ?? null,
    isPending: session ? memberPending || isPending : false,
    // Un guasto non è «questa prenotazione non esiste»: sono due frasi
    // diverse e la pagina deve poterle distinguere.
    error: memberError ?? error,
  }
}

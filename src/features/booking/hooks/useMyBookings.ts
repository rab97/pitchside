import { useQuery } from '@tanstack/react-query'
import { parseRange } from '@/shared/lib/range'
import { supabase } from '@/shared/lib/supabase'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { useMyMember } from '@/features/auth/hooks/useMyMember'
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
 * Filtra per `member_id` — non per sicurezza, per intento. La RLS
 * (`bookings_read_own` OR `bookings_read_admin`) decide cosa questo utente
 * *può* leggere, ed è quello il confine che conta: per un amministratore
 * significa l'intera struttura, perché è ciò che fa funzionare la griglia
 * del gestore in `/admin`. Ma "le tue prenotazioni" chiede un'altra cosa —
 * quali righe sono *sue* — e quella domanda la RLS non se la pone. Un
 * amministratore che è anche cliente (il seed collega proprio così l'owner:
 * "il gestore prenota come chiunque altro") vedrebbe qui lo storico di
 * chiunque altro, non solo il proprio, se ci si fermasse alla sola RLS.
 * Questo filtro non è quindi una regola di sicurezza duplicata nel client:
 * è la query giusta per questa schermata, con la RLS che resta comunque
 * l'unico confine su cosa è leggibile.
 *
 * Il filtro su `facility_id` è un'altra cosa ancora: non riguarda
 * l'appartenenza (quella la fa la RLS), ma il fatto che lo stesso numero di
 * telefono può essere cliente di più strutture (`members_facility_phone_uniq`
 * è per struttura, non globale) — questa pagina vive sul dominio di una sola
 * e non deve mostrare lo storico delle altre.
 */
export function useMyBookings() {
  const facility = useFacility()
  const { session } = useAuth()
  const { memberId, error: memberError } = useMyMember()

  const { data, isPending, error } = useQuery({
    queryKey: ['my-bookings', facility.id, memberId],
    enabled: !!session && !!memberId,
    queryFn: async (): Promise<MyBooking[]> => {
      const { data, error } = await supabase
        .from('bookings')
        .select('id, slot, status, price_cents, cancel_deadline, fields(name, kind)')
        .eq('facility_id', facility.id)
        .eq('member_id', memberId as string)
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

  return {
    future,
    past,
    isPending: session ? isPending : false,
    // Anche il guasto di `ensure_my_member` finisce qui: senza la scheda
    // questa query non parte nemmeno, e senza il suo errore la pagina
    // resterebbe in «Caricamento…» per sempre.
    error: memberError ?? error,
  }
}

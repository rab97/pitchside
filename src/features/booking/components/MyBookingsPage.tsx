import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { formatEuro } from '@/shared/lib/money'
import { minToLabel, minutesOfDay } from '@/shared/lib/tz'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { LoginPage } from '@/features/auth/components/LoginPage'
import { fieldKind } from '../utils/fieldKind'
import { useMyBookings, type MyBooking } from '../hooks/useMyBookings'
import { MY_BOOKINGS_ERROR } from '../utils/messages'

// Solo gli stati diversi da "active" portano un'etichetta: una prenotazione
// ancora attiva si capisce già dalla sezione in cui compare.
const STATUS_LABEL: Record<string, string> = {
  cancelled: 'Disdetta',
  no_show: 'Non presentata',
}

export function MyBookingsPage() {
  const facility = useFacility()
  const { session, loading } = useAuth()

  if (loading) return <div className="p-8 text-muted">Caricamento…</div>
  if (!session) return <LoginPage />

  return (
    <div className="min-h-screen bg-ground">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1140px] items-center gap-3 px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div
              className="grid h-8 w-8 place-items-center rounded-full bg-pitch text-sm font-semibold text-white"
              aria-hidden
            >
              {facility.name.charAt(0)}
            </div>
            <span className="text-[15px] font-semibold tracking-[-.01em]">
              {facility.name}
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1140px] px-4 py-6 sm:px-6">
        <p className="text-[11px] uppercase tracking-[.14em] text-pitch">
          {facility.name}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-.02em]">
          Le tue prenotazioni
        </h1>

        <MyBookingsList />
      </main>
    </div>
  )
}

function MyBookingsList() {
  const { future, past, isPending, error } = useMyBookings()

  // L'errore prima del caricamento, e non dopo: se è `ensure_my_member` a
  // fallire questa query non parte nemmeno, `isPending` resta vero per sempre
  // e la pagina resterebbe in «Caricamento…» senza dire niente.
  if (error) {
    return (
      <div className="mt-6">
        <ErrorNote message={MY_BOOKINGS_ERROR} />
      </div>
    )
  }

  if (isPending) return <p className="mt-6 text-ink-2">Caricamento…</p>

  if (future.length === 0 && past.length === 0) {
    return (
      <div className="mt-6 rounded-card border border-line bg-surface p-6 shadow-card">
        <p className="text-ink-2">
          Non hai ancora prenotazioni.{' '}
          <Link to="/prenota" className="font-medium text-pitch underline">
            Guarda i campi liberi →
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6 flex flex-col gap-8">
      <section>
        <h2 className="text-[13px] font-medium uppercase tracking-[.08em] text-muted">
          Prossime
        </h2>
        {future.length === 0 ? (
          <p className="mt-3 text-ink-2">Nessuna prenotazione in programma.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {future.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-[13px] font-medium uppercase tracking-[.08em] text-muted">
          Passate
        </h2>
        {past.length === 0 ? (
          <p className="mt-3 text-ink-2">Nessuna prenotazione passata.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2.5">
            {past.map((b) => (
              <BookingRow key={b.id} booking={b} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// La riga è un collegamento, non un blocco inerte: il dettaglio — e quindi
// la disdetta — era raggiungibile solo digitando un UUID a mano.
//
// Il `Link` avvolge tutta la riga perché tutta la riga è il bersaglio, ma il
// testo del collegamento sarebbe la concatenazione di data, ora, campo,
// prezzo e stato: `aria-label` lo sostituisce con una frase sola, così chi
// scorre i collegamenti con uno screen reader sente quale prenotazione apre.
function BookingRow({ booking }: { booking: MyBooking }) {
  const statusLabel = STATUS_LABEL[booking.status]
  const label =
    `Prenotazione del ${format(booking.slot_start, 'd MMMM', { locale: it })}` +
    ` alle ${minToLabel(minutesOfDay(booking.slot_start))}, ${booking.field_name}` +
    (statusLabel ? `, ${statusLabel.toLowerCase()}` : '')

  return (
    <li>
      <Link
        to={`/prenotazioni/${booking.id}`}
        aria-label={label}
        className="flex flex-col gap-2 rounded-card border border-line bg-surface p-4 shadow-card transition hover:border-pitch sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <p className="text-[15px] font-semibold tracking-[-.01em]">
            {format(booking.slot_start, 'EEE d MMM', { locale: it })}
            {' · '}
            <span className="tabular-nums">
              {minToLabel(minutesOfDay(booking.slot_start))}–{minToLabel(minutesOfDay(booking.slot_end))}
            </span>
          </p>
          <p className="mt-1 text-[13px] text-ink-2">
            {booking.field_name} · {fieldKind(booking.field_kind)}
          </p>
        </div>

        <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
          <span className="tabular-nums text-[13.5px] font-medium">
            {formatEuro(booking.price_cents)}
          </span>
          {statusLabel && (
            <span className="rounded-full border border-terra bg-terra-tint px-2 py-0.5 text-[11px] font-medium text-terra">
              {statusLabel}
            </span>
          )}
        </div>
      </Link>
    </li>
  )
}

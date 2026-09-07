import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { MobileFrame } from '@/shared/components/ui/MobileFrame'
import { formatEuro } from '@/shared/lib/money'
import { minToLabel, minutesOfDay } from '@/shared/lib/tz'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { LoginPage } from '@/features/auth/components/LoginPage'
import { CancelBookingError, isLateCancel, useCancelBooking } from '@/shared/hooks/useCancelBooking'
import { fieldKind } from '../utils/fieldKind'
import { messageForCustomer } from '../utils/cancelBookingMessage'
import { useBooking } from '../hooks/useBooking'
import { BOOKING_ERROR } from '../utils/messages'

// Solo gli stati diversi da "active" portano un'etichetta: se la
// prenotazione è ancora attiva la pagina lo mostra col resto del dettaglio,
// non con un badge a parte.
const STATUS_LABEL: Record<string, string> = {
  cancelled: 'Disdetta',
  no_show: 'Non presentata',
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line-soft py-2 text-[13px]">
      <span className="text-muted">{label}</span>
      <b className="text-right font-medium">{children}</b>
    </div>
  )
}

function PageHeader() {
  const facility = useFacility()
  return (
    <header className="hidden border-b border-line bg-surface lg:block">
      <div className="mx-auto flex max-w-[1140px] items-center gap-3 px-4 py-3.5 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <div
            className="grid h-8 w-8 place-items-center rounded-full bg-pitch text-sm font-semibold text-on-pitch"
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
  )
}

export function BookingPage() {
  const { id } = useParams<{ id: string }>()
  const { session, loading } = useAuth()

  if (loading) return <div className="p-8 text-muted">Caricamento…</div>
  if (!session) return <LoginPage />

  return (
    // L'unica schermata cliente *spinta*: si arriva qui da un elenco, quindi
    // la barra alta mostra il chevron che torna a quell'elenco invece del
    // marchietto. Il titolo del contenuto — l'orario — resta l'`<h1>` della
    // pagina, e la barra si limita a dire dove siamo.
    <MobileFrame title="Prenotazione" backTo="/prenotazioni">
      <PageHeader />
      <main className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <BookingDetail id={id} />
      </main>
    </MobileFrame>
  )
}

function BookingDetail({ id }: { id: string | undefined }) {
  const navigate = useNavigate()
  const { booking, isPending, error } = useBooking(id)
  const cancel = useCancelBooking()
  const [confirming, setConfirming] = useState(false)

  useEffect(() => { setConfirming(false) }, [id])

  // «Questa prenotazione non esiste» è un'affermazione: si dice solo quando
  // la si è potuta cercare. Un guasto è un'altra cosa, e va detta per quello
  // che è — anche perché con `ensure_my_member` in errore la ricerca non
  // parte, e `isPending` non tornerebbe mai falso.
  if (error) {
    return (
      <div className="rounded-card border border-line bg-surface p-6 shadow-card">
        <ErrorNote message={BOOKING_ERROR} />
      </div>
    )
  }

  if (isPending) return <p className="mt-6 text-ink-2">Caricamento…</p>

  // Una riga che non esiste e una riga che esiste ma non è dell'utente
  // arrivano qui allo stesso modo — `useBooking` filtra per `member_id`, non
  // solo per `id` — e la pagina le tratta identiche: dire che esiste
  // rivelerebbe a chi non ne ha diritto che quella prenotazione c'è.
  if (!booking) {
    return (
      <div className="rounded-card border border-line bg-surface p-6 shadow-card">
        <p className="text-ink-2">
          Questa prenotazione non esiste.{' '}
          <Link to="/prenotazioni" className="font-medium text-pitch underline transition-colors hover:text-pitch-strong">
            Torna alle tue prenotazioni →
          </Link>
        </p>
      </div>
    )
  }

  const late = isLateCancel(booking.cancel_deadline, new Date())
  const statusLabel = STATUS_LABEL[booking.status]

  async function doCancel() {
    if (!booking) return
    try {
      await cancel.mutateAsync({ id: booking.id })
      toast.success('Disdetta. Il campo è di nuovo libero.')
      navigate('/prenotazioni')
    } catch (e) {
      toast.error(messageForCustomer(e instanceof CancelBookingError ? e.code : ''))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[11px] uppercase tracking-[.14em] text-pitch">
        {statusLabel ?? 'Confermata'}
      </p>

      <div className="rounded-card border border-line bg-surface p-4 shadow-card">
        <p className="text-[13px] text-muted">
          {format(booking.slot_start, 'EEEE d MMMM', { locale: it })}
        </p>
        <h1 className="tabular-nums text-xl font-semibold tracking-[-.01em]">
          {minToLabel(minutesOfDay(booking.slot_start))} – {minToLabel(minutesOfDay(booking.slot_end))}
        </h1>
        <p className="mt-1 text-[13.5px] text-ink-2">
          {booking.field_name} · {fieldKind(booking.field_kind)}
        </p>

        <div className="mt-3">
          <Kv label="Da pagare in struttura"><span className="tabular-nums">{formatEuro(booking.price_cents)}</span></Kv>
          <Kv label="Disdetta gratuita entro">
            <span className={`tabular-nums ${late ? 'text-terra' : ''}`}>
              {format(booking.cancel_deadline, "EEE d MMM, HH:mm", { locale: it })}
              {late ? ' · scaduta' : ''}
            </span>
          </Kv>
        </div>
      </div>

      {booking.status === 'active' && (
        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          {!confirming ? (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="w-full rounded-lg border border-terra py-2 text-sm text-terra transition-colors hover:bg-terra-tint"
            >
              Disdici la prenotazione
            </button>
          ) : (
            <div className="rounded-lg border border-terra bg-terra-tint p-3 text-[12.5px] text-terra">
              {late
                ? 'Siamo oltre il termine: la prenotazione risulterà come mancata presenza e inciderà sulla tua affidabilità.'
                : 'Disdici entro il termine e non paghi nulla: il campo torna libero per gli altri.'}
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirming(false)}
                  className="rounded-[7px] border border-line px-3 py-1.5 text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  disabled={cancel.isPending}
                  onClick={doCancel}
                  className="rounded-[7px] bg-terra px-3 py-1.5 font-medium text-on-terra transition-colors hover:bg-terra-strong"
                >
                  {cancel.isPending ? 'Disdico…' : 'Conferma la disdetta'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

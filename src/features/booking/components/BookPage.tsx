import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { format, isToday, subHours } from 'date-fns'
import { it } from 'date-fns/locale'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { FieldPicker } from '@/shared/components/ui/FieldPicker'
import { MobileFrame } from '@/shared/components/ui/MobileFrame'
import { formatEuro } from '@/shared/lib/money'
import { parseRange } from '@/shared/lib/range'
import { LOGIN_ROUTE } from '@/shared/lib/routes'
import { dayKey, minToLabel, minutesOfDay, slotRange } from '@/shared/lib/tz'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useFields } from '@/shared/hooks/useFields'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { freeSlots } from '../utils/freeSlots'
import { durationLabel } from '../utils/durationLabel'
import { savePendingSelection, takePendingSelection } from '../utils/pendingSelection'
import { FIELDS_ERROR, NO_FIELDS, SLOT_GONE, SLOTS_ERROR } from '../utils/messages'
import { horizonLimit, maxStartMinForDay } from '../utils/horizon'
import { useAvailability } from '../hooks/useAvailability'
import { useSlotPrices } from '../hooks/useSlotPrices'
import { DayStrip } from './DayStrip'
import { CancelNote, SummaryRows } from './BookingSummary'
import { ConfirmSheet } from './ConfirmSheet'
import { ConfirmBookingDialog } from './ConfirmBookingDialog'

const DURATIONS = [60, 90, 120]

export function BookPage() {
  const facility = useFacility()
  const { fields, isPending: fieldsPending, error: fieldsError } = useFields()
  const navigate = useNavigate()
  const { session, loading: authLoading } = useAuth()
  const [day, setDay] = useState<Date>(() => new Date())
  const [fieldId, setFieldId] = useState<string | null>(null)
  const [minutes, setMinutes] = useState(facility.min_duration_minutes || 60)
  const [startMin, setStartMin] = useState<number | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const slotListRef = useRef<HTMLDivElement>(null)

  // Cambiando campo, giorno o durata lo slot scelto prima potrebbe non
  // esistere più tra quelli liberi: si riparte da capo invece di lasciare
  // selezionato un orario che la lista non mostra. Questo succede solo per
  // una scelta dell'utente (non per il ripristino post-accedi, sotto), quindi
  // sta nei gestori di clic stessi — non in un effetto che osserva i cambi —
  // ed è già così che il ripristino può impostare tutti e quattro i valori
  // insieme senza che nulla li annulli di nuovo nel giro successivo.
  function selectField(id: string) { setFieldId(id); setStartMin(null) }
  function selectDay(d: Date) { setDay(d); setStartMin(null) }
  function selectMinutes(m: number) { setMinutes(m); setStartMin(null) }

  // Cambiando campo, giorno o durata l'elenco degli orari torna in cima:
  // altrimenti chi ha scorso fino in fondo resterebbe a metà elenco su dati
  // diversi, senza accorgersi che sono cambiati. Le dipendenze sono le scelte
  // dell'utente (fieldId, day, minutes), non isPending/isRefreshing: un
  // aggiornamento che serve dati della chiave precedente (placeholderData,
  // vedi sopra) non deve far scattare il ritorno in cima.
  useEffect(() => {
    if (slotListRef.current) slotListRef.current.scrollTop = 0
  }, [fieldId, day, minutes])

  // All'apertura si sceglie un campo per mostrare subito fasce e prezzi, a
  // meno che non si stia tornando da /accedi?next=/prenota con una scelta
  // in sospeso: in quel caso la si ritrova in sessionStorage (vedi
  // utils/pendingSelection, scritta da chi ha premuto "Conferma" senza
  // sessione) e si apre subito il riepilogo, invece di far ricominciare la
  // scelta da capo. La guardia è un `ref`, non uno stato: in sviluppo React
  // invoca due volte gli effect al montaggio, e uno stato aggiornato in coda
  // non è ancora visibile alla seconda chiamata — sessionStorage sì, e
  // verrebbe consumato a vuoto la seconda volta.
  const initRef = useRef(false)
  const [openAfterRestore, setOpenAfterRestore] = useState(false)
  useEffect(() => {
    if (initRef.current || fields.length === 0) return
    initRef.current = true

    const pending = takePendingSelection()
    const restored = pending && fields.some((f) => f.id === pending.fieldId) ? pending : null

    if (restored) {
      setFieldId(restored.fieldId)
      setDay(new Date(restored.dayIso))
      setMinutes(restored.minutes)
      setStartMin(restored.startMin)
      setOpenAfterRestore(true)
    } else if (!fieldId) {
      setFieldId(fields[0].id)
    }
  }, [fields, fieldId])

  useEffect(() => {
    if (openAfterRestore && session) {
      setConfirmOpen(true)
      setOpenAfterRestore(false)
    }
  }, [openAfterRestore, session])

  const field = fields.find((f) => f.id === fieldId) ?? null
  const {
    busy, isPending: busyPending, isPlaceholderData: busyPlaceholder, error: busyError,
  } = useAvailability(day, fieldId)
  const {
    prices, isPending: pricesPending, isPlaceholderData: pricesPlaceholder, error: pricesError,
  } = useSlotPrices(day, fieldId, minutes)
  const isPending = busyPending || pricesPending
  // Vero mentre l'una o l'altra sta ancora servendo i dati della chiave
  // precedente (giorno, campo o durata cambiati): l'elenco resta quello di
  // prima, con un segnale discreto, invece di svuotarsi per i millisecondi
  // della richiesta — vedi placeholderData in useAvailability/useSlotPrices.
  const isRefreshing = busyPlaceholder || pricesPlaceholder
  const slotsError = busyError ?? pricesError

  // Le partenze sono le chiavi che `slot_prices` ha restituito, non una
  // griglia rigenerata da apertura, chiusura e passo: quella faceva
  // ricomparire in elenco, con «—» al posto del prezzo, le partenze che
  // `slot_prices` salta perché cadono in un buco fra due fasce. Erano
  // selezionabili, arrivavano al riepilogo con «Totale —» e la conferma
  // moriva con PS005. Su una schermata che riguarda denaro l'elenco degli
  // orari e la fonte del prezzo sono lo stesso insieme.
  // Un campo chiuso quel giorno della settimana non ha partenze, e la lista
  // resta vuota senza bisogno di un caso speciale.
  const nowMin = isToday(day) ? minutesOfDay(new Date()) : undefined

  // L'orizzonte di prenotazione è un istante, non un giorno intero:
  // `create_booking` rifiuta con PS007 tutto ciò che parte dopo
  // `now() + booking_horizon_days`. L'ultimo giorno della striscia è quindi
  // prenotabile solo fino a quell'ora, e mostrarlo pieno di orari prezzati
  // significava proporre al cliente una conferma che il database rifiuta.
  // Il calcolo del limite sta in `utils/horizon.ts`, che spiega perché si
  // contano ore e non giorni di calendario.
  const maxStartMin = maxStartMinForDay(
    day, horizonLimit(new Date(), facility.booking_horizon_days))

  const slots = freeSlots({
    starts: Array.from(prices.keys()),
    durationMin: minutes, busy, nowMin, maxStartMin,
  })
  const price = startMin != null ? prices.get(startMin) ?? null : null

  // Il gesto di confermare sta qui, non nelle due cornici che lo mostrano
  // (la card a fianco su schermo largo, il foglio in basso su telefono): è la
  // parte che decide, e decidere due volte è il modo di farle divergere.
  function handleConfirm() {
    if (!field || startMin == null) return
    if (!session) {
      savePendingSelection({
        fieldId: field.id, dayIso: day.toISOString(), minutes, startMin,
      })
      navigate(`${LOGIN_ROUTE}?next=${encodeURIComponent('/prenota')}`)
      return
    }
    setConfirmOpen(true)
  }

  const cancelDeadline = (() => {
    if (startMin == null) return null
    const [start] = parseRange(slotRange(dayKey(day), startMin, minutes))
    return subHours(start, facility.cancel_hours)
  })()

  return (
    // `fill`: su telefono questa schermata è alta esattamente lo schermo e
    // non scorre. Scorre solo l'elenco degli orari, qui sotto, che si
    // dichiara l'unico scorrevole con `flex-1 min-h-0 overflow-y-auto`. È la
    // catena che tiene ferme le scelte in alto — campo, giorno, durata —
    // mentre si cerca l'ora: su un telefono, scorrendo tutta la pagina,
    // uscivano dallo schermo proprio quando si voleva cambiarle.
    <MobileFrame title="Prenota" fill>
      {/* Su telefono il titolo è nella barra alta del guscio: qui resta
          l'intestazione col nome della struttura, che è quella da schermo
          largo. */}
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

      <main className="mx-auto flex h-full min-h-0 max-w-[1140px] flex-col px-4 py-3 sm:px-6 lg:block lg:h-auto lg:py-6">
        <p className="hidden text-[11px] uppercase tracking-[.14em] text-pitch lg:block">
          {facility.name}
        </p>
        {/* `sr-only` e non `hidden`: su telefono il titolo visibile è quello
            della barra alta, ma la pagina deve comunque avere un `<h1>` per
            chi la ascolta — `hidden` lo toglierebbe anche a loro. */}
        <h1 className="sr-only lg:not-sr-only lg:mt-1.5 lg:text-2xl lg:font-semibold lg:tracking-[-.02em]">
          Prenota
        </h1>

        {fieldsError ? (
          <div className="mt-6">
            <ErrorNote message={FIELDS_ERROR} />
          </div>
        ) : fieldsPending ? (
          <p className="mt-6 text-ink-2">Caricamento…</p>
        ) : fields.length === 0 ? (
          <p className="mt-6 text-ink-2">{NO_FIELDS}</p>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col gap-5 lg:mt-5 lg:grid lg:flex-none lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="flex min-h-0 flex-1 flex-col gap-4 lg:flex-none">
              <FieldPicker fields={fields} selected={fieldId} onSelect={selectField} />

              <DayStrip day={day} onSelect={selectDay} horizonDays={facility.booking_horizon_days} />

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-[.06em] text-muted">Durata</span>
                <div className="flex gap-1.5">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={minutes === d}
                      onClick={() => selectMinutes(d)}
                      className={
                        'flex-1 rounded-lg border py-2 text-center text-[13px] transition-colors ' +
                        (minutes === d
                          ? 'border-pitch bg-pitch text-on-pitch'
                          : 'border-line bg-surface text-ink-2 hover:border-pitch')
                      }
                    >
                      {durationLabel(d)}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-card border border-line bg-surface shadow-card lg:flex-none">
                <div className="border-b border-line-soft bg-surface-2 px-3.5 py-2.5">
                  <span className="text-[11px] uppercase tracking-[.06em] text-muted">
                    Orari liberi
                    {field ? ` · ${field.name}` : ''}
                  </span>
                </div>
                {/* L'unico elemento scorrevole della schermata su telefono:
                    prende l'altezza che resta (`flex-1 min-h-0`) e scorre
                    dentro di sé. `overscroll-contain` qui non intrappola più
                    niente — la pagina intorno non scorre per scelta, e la
                    conferma non sta più in fondo alla pagina ma fissa in
                    basso. Da `lg` in su torna un tetto in vh, perché lì la
                    pagina scorre e l'elenco non deve mangiarsela tutta.
                    Il riempimento in basso è lo spazio del foglio di
                    conferma: senza, gli ultimi orari resterebbero sotto di
                    lui, e sono quelli che si cerca quando si gioca tardi. */}
                <div
                  ref={slotListRef}
                  className={
                    'min-h-0 flex-1 overflow-y-auto overscroll-contain lg:max-h-[55vh] lg:flex-none ' +
                    (field && startMin != null ? 'pb-28 lg:pb-0 ' : '') +
                    (isRefreshing ? 'opacity-60' : '')
                  }
                  aria-busy={isRefreshing}
                >
                  {slotsError ? (
                    <div className="p-2.5">
                      <ErrorNote message={SLOTS_ERROR} />
                    </div>
                  ) : isPending ? (
                    <p className="p-4 text-ink-2">Caricamento…</p>
                  ) : slots.length === 0 ? (
                    <p className="p-4 text-ink-2">
                      Nessun orario libero per questa durata, in questo giorno.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1.5 p-2.5">
                      {slots.map((s) => {
                        // `slots` è un sottoinsieme delle chiavi di `prices`:
                        // il prezzo c'è per costruzione, e non esiste più uno
                        // slot selezionabile senza importo.
                        const slotPrice = prices.get(s) as number
                        const selected = s === startMin
                        return (
                          <li key={s}>
                            <button
                              type="button"
                              aria-pressed={selected}
                              onClick={() => setStartMin(s)}
                              className={
                                'flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition ' +
                                (selected
                                  ? 'border-pitch bg-pitch-tint text-pitch'
                                  : 'border-line bg-surface text-ink hover:border-pitch')
                              }
                            >
                              <span className="tabular-nums text-[13.5px] font-medium">
                                {minToLabel(s)}–{minToLabel(s + minutes)}
                              </span>
                              <span className="tabular-nums text-[12.5px]">
                                {formatEuro(slotPrice)}
                              </span>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* La card a fianco è il riepilogo da schermo largo. Su telefono
                al suo posto c'è `ConfirmSheet`, che appare in basso appena si
                sceglie un orario: qui sotto sarebbe in fondo alla pagina, e
                per raggiungerla bisognava spostare lo schermo da soli. */}
            <aside className="hidden flex-col gap-3.5 rounded-card border border-line bg-surface p-4 shadow-card lg:sticky lg:top-6 lg:flex">
              <span className="text-[11px] uppercase tracking-[.06em] text-muted">
                La tua prenotazione
              </span>

              {field && startMin != null ? (
                <>
                  <p className="text-[15px] font-semibold tracking-[-.01em]">
                    {format(day, 'EEE d MMM', { locale: it })} · {minToLabel(startMin)}
                  </p>
                  <SummaryRows field={field} minutes={minutes} price={price} />

                  {price == null && (
                    <p className="text-[12.5px] text-terra">{SLOT_GONE}</p>
                  )}

                  <button
                    type="button"
                    disabled={authLoading || price == null}
                    onClick={handleConfirm}
                    className="mt-1 rounded-lg bg-pitch px-4 py-2.5 text-center text-sm font-medium text-on-pitch transition-colors hover:bg-pitch-strong"
                  >
                    Conferma
                  </button>
                  <CancelNote cancelDeadline={cancelDeadline} />
                </>
              ) : (
                <>
                  <p className="text-[13px] text-ink-2">
                    Scegli un campo, un giorno e un orario per vedere il riepilogo.
                  </p>
                  <button
                    type="button"
                    disabled
                    className="mt-1 rounded-lg bg-pitch px-4 py-2.5 text-center text-sm font-medium text-on-pitch"
                  >
                    Conferma
                  </button>
                </>
              )}
            </aside>
          </div>
        )}
      </main>

      {field && startMin != null && (
        <ConfirmSheet
          field={field}
          day={day}
          startMin={startMin}
          minutes={minutes}
          price={price}
          cancelDeadline={cancelDeadline}
          disabled={authLoading || price == null}
          onConfirm={handleConfirm}
        />
      )}

      <ConfirmBookingDialog
        open={confirmOpen && !!field && startMin != null}
        onClose={() => setConfirmOpen(false)}
        onBooked={() => setStartMin(null)}
        field={field}
        day={day}
        startMin={startMin}
        minutes={minutes}
        price={price}
        cancelDeadline={cancelDeadline}
      />
    </MobileFrame>
  )
}

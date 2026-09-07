import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { addDays, format, isSameDay, isToday, subHours } from 'date-fns'
import { it } from 'date-fns/locale'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { formatEuro } from '@/shared/lib/money'
import { parseRange } from '@/shared/lib/range'
import { dayKey, minToLabel, minutesOfDay, slotRange } from '@/shared/lib/tz'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useFields, type FieldRow } from '@/shared/hooks/useFields'
import { useAuth } from '@/features/auth/hooks/AuthProvider'
import { freeSlots } from '../utils/freeSlots'
import { fieldKind } from '../utils/fieldKind'
import { savePendingSelection, takePendingSelection } from '../utils/pendingSelection'
import { FIELDS_ERROR, NO_FIELDS, SLOTS_ERROR } from '../utils/messages'
import { useAvailability } from '../hooks/useAvailability'
import { useSlotPrices } from '../hooks/useSlotPrices'
import { DayStrip } from './DayStrip'
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
  const { busy, isPending: busyPending, error: busyError } = useAvailability(day, fieldId)
  const { prices, isPending: pricesPending, error: pricesError } = useSlotPrices(day, fieldId, minutes)
  const isPending = busyPending || pricesPending
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
  // prenotabile solo fino all'ora in cui siamo adesso, e mostrarlo pieno di
  // orari prezzati significava proporre al cliente una conferma che il
  // database rifiuta. Negli altri giorni il limite non c'entra.
  const horizonLimit = addDays(new Date(), facility.booking_horizon_days)
  const maxStartMin = isSameDay(day, horizonLimit)
    ? minutesOfDay(horizonLimit)
    : undefined

  const slots = freeSlots({
    starts: Array.from(prices.keys()),
    durationMin: minutes, busy, nowMin, maxStartMin,
  })
  const price = startMin != null ? prices.get(startMin) ?? null : null

  const cancelDeadline = (() => {
    if (startMin == null) return null
    const [start] = parseRange(slotRange(dayKey(day), startMin, minutes))
    return subHours(start, facility.cancel_hours)
  })()

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
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-.02em]">Prenota</h1>

        {fieldsError ? (
          <div className="mt-6">
            <ErrorNote message={FIELDS_ERROR} />
          </div>
        ) : fieldsPending ? (
          <p className="mt-6 text-ink-2">Caricamento…</p>
        ) : fields.length === 0 ? (
          <p className="mt-6 text-ink-2">{NO_FIELDS}</p>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="flex flex-col gap-4">
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
                        'flex-1 rounded-lg border py-2 text-center text-[13px] ' +
                        (minutes === d
                          ? 'border-pitch bg-pitch text-white'
                          : 'border-line bg-surface text-ink-2')
                      }
                    >
                      {d === 60 ? '1h' : d === 90 ? '1h 30' : '2h'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
                <div className="border-b border-line-soft bg-surface-2 px-3.5 py-2.5">
                  <span className="text-[11px] uppercase tracking-[.06em] text-muted">
                    Orari liberi
                    {field ? ` · ${field.name}` : ''}
                  </span>
                </div>
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

            <aside className="flex flex-col gap-3.5 rounded-card border border-line bg-surface p-4 shadow-card">
              <span className="text-[11px] uppercase tracking-[.06em] text-muted">
                La tua prenotazione
              </span>

              {field && startMin != null ? (
                <>
                  <p className="text-[15px] font-semibold tracking-[-.01em]">
                    {format(day, 'EEE d MMM', { locale: it })} · {minToLabel(startMin)}
                  </p>
                  <dl className="flex flex-col gap-1.5 text-[13px]">
                    <div className="flex justify-between">
                      <dt className="text-muted">Campo</dt>
                      <dd className="font-medium">
                        {field.name} · {fieldKind(field.kind)}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted">Durata</dt>
                      <dd className="tabular-nums font-medium">
                        {minutes === 60 ? '1h' : minutes === 90 ? '1h 30' : '2h'}
                      </dd>
                    </div>
                    <div className="flex justify-between border-t border-line-soft pt-1.5">
                      <dt className="text-muted">Totale</dt>
                      <dd className="tabular-nums font-semibold">
                        {price != null ? formatEuro(price) : '—'}
                      </dd>
                    </div>
                  </dl>

                  {/* Senza prezzo non si conferma: succede solo a una scelta
                      ripristinata dopo l'accesso, se nel frattempo quello slot
                      non è più fra quelli prezzati. Il database risponderebbe
                      PS005; è più onesto dirlo prima. */}
                  {price == null && (
                    <p className="text-[12.5px] text-terra">
                      Questo orario non è più disponibile: scegline un altro.
                    </p>
                  )}

                  <button
                    type="button"
                    disabled={authLoading || price == null}
                    onClick={() => {
                      if (!field || startMin == null) return
                      if (!session) {
                        savePendingSelection({
                          fieldId: field.id, dayIso: day.toISOString(), minutes, startMin,
                        })
                        navigate(`/accedi?next=${encodeURIComponent('/prenota')}`)
                        return
                      }
                      setConfirmOpen(true)
                    }}
                    className="mt-1 rounded-lg bg-pitch px-4 py-2.5 text-center text-sm font-medium text-white disabled:opacity-50"
                  >
                    Conferma
                  </button>
                  <p className="text-[11.5px] leading-[1.5] text-muted">
                    Si paga in struttura.
                    {cancelDeadline
                      ? ` Puoi disdire gratis fino a ${format(cancelDeadline, 'EEE d MMM', { locale: it })} alle ${format(cancelDeadline, 'HH:mm')}.`
                      : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-ink-2">
                    Scegli un campo, un giorno e un orario per vedere il riepilogo.
                  </p>
                  <button
                    type="button"
                    disabled
                    className="mt-1 rounded-lg bg-pitch px-4 py-2.5 text-center text-sm font-medium text-white"
                  >
                    Conferma
                  </button>
                </>
              )}
            </aside>
          </div>
        )}
      </main>

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
    </div>
  )
}

function FieldPicker({ fields, selected, onSelect }: {
  fields: FieldRow[]
  selected: string | null
  onSelect: (id: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {fields.map((f) => {
        const isSelected = f.id === selected
        return (
          <button
            key={f.id}
            type="button"
            aria-pressed={isSelected}
            onClick={() => onSelect(f.id)}
            className={
              'rounded-lg border px-3 py-2 text-left transition ' +
              (isSelected
                ? 'border-pitch bg-pitch-tint text-pitch'
                : 'border-line bg-surface text-ink-2 hover:border-pitch')
            }
          >
            <span className="block text-[13px] font-medium">{f.name}</span>
            <span className="block text-[10.5px] text-muted">
              {fieldKind(f.kind)} · {f.covered ? 'coperto' : 'scoperto'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

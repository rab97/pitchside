import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { format, isToday, subHours } from 'date-fns'
import { it } from 'date-fns/locale'
import { formatEuro } from '@/shared/lib/money'
import { parseRange } from '@/shared/lib/range'
import { dayKey, minToLabel, minutesOfDay, slotRange } from '@/shared/lib/tz'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useFields, type FieldRow } from '@/shared/hooks/useFields'
import { freeSlots } from '../utils/freeSlots'
import { useAvailability } from '../hooks/useAvailability'
import { useSlotPrices } from '../hooks/useSlotPrices'
import { DayStrip } from './DayStrip'

const DURATIONS = [60, 90, 120]

function fieldKind(kind: string): string {
  return kind === 'calcio7' ? 'a 7' : kind === 'calcio11' ? 'a 11' : 'a 5'
}

export function BookPage() {
  const facility = useFacility()
  const fields = useFields()
  const [day, setDay] = useState<Date>(() => new Date())
  const [fieldId, setFieldId] = useState<string | null>(null)
  const [minutes, setMinutes] = useState(facility.min_duration_minutes || 60)
  const [startMin, setStartMin] = useState<number | null>(null)

  // Nessun campo scelto all'apertura: si prende il primo appena arriva, così
  // chi guarda senza account vede subito fasce e prezzi, non una pagina vuota
  // in attesa di un clic.
  useEffect(() => {
    if (!fieldId && fields.length > 0) setFieldId(fields[0].id)
  }, [fieldId, fields])

  // Cambiando campo, giorno o durata lo slot scelto prima potrebbe non
  // esistere più tra quelli liberi: si riparte da capo invece di lasciare
  // selezionato un orario che la lista non mostra.
  useEffect(() => { setStartMin(null) }, [fieldId, day, minutes])

  const field = fields.find((f) => f.id === fieldId) ?? null
  const { busy, isPending: busyPending } = useAvailability(day, fieldId)
  const { prices, isPending: pricesPending } = useSlotPrices(day, fieldId, minutes)
  const isPending = busyPending || pricesPending

  // L'orario apribile del giorno non è più una costante: è l'insieme delle
  // partenze che `slot_prices` ha già prezzato, ricavate a sua volta dalle
  // `price_bands` del campo (vedi supabase/migrations/0014_slot_prices.sql).
  // Un campo chiuso quel giorno della settimana non ha partenze, e la lista
  // resta vuota senza bisogno di un caso speciale.
  const starts = Array.from(prices.keys())
  const openMin = starts.length > 0 ? Math.min(...starts) : 0
  const closeMin = starts.length > 0 ? Math.max(...starts) + minutes : 0

  const nowMin = isToday(day) ? minutesOfDay(new Date()) : undefined
  const slots = freeSlots({
    openMin, closeMin, stepMin: facility.slot_minutes,
    durationMin: minutes, busy, nowMin,
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
        <p className="tabular-nums text-[11px] uppercase tracking-[.14em] text-pitch">
          {facility.name}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-.02em]">Prenota</h1>

        {fields.length === 0 ? (
          <p className="mt-6 text-ink-2">Nessun campo attivo in questa struttura.</p>
        ) : (
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="flex flex-col gap-4">
              <FieldPicker fields={fields} selected={fieldId} onSelect={setFieldId} />

              <DayStrip day={day} onSelect={setDay} horizonDays={facility.booking_horizon_days} />

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] uppercase tracking-[.06em] text-muted">Durata</span>
                <div className="flex gap-1.5">
                  {DURATIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={minutes === d}
                      onClick={() => setMinutes(d)}
                      className={
                        'flex-1 rounded-lg border py-2 text-center tabular-nums text-[13px] ' +
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
                {isPending ? (
                  <p className="p-4 text-ink-2">Caricamento…</p>
                ) : slots.length === 0 ? (
                  <p className="p-4 text-ink-2">
                    Nessun orario libero per questa durata, in questo giorno.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-1.5 p-2.5">
                    {slots.map((s) => {
                      const slotPrice = prices.get(s) ?? null
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
                              {slotPrice != null ? formatEuro(slotPrice) : '—'}
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

                  <Link
                    to={`/accedi?next=${encodeURIComponent('/prenota')}`}
                    className="mt-1 block rounded-lg bg-pitch px-4 py-2.5 text-center text-sm font-medium text-white"
                  >
                    Conferma
                  </Link>
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
            <span className="block tabular-nums text-[10.5px] text-muted">
              {fieldKind(f.kind)} · {f.covered ? 'coperto' : 'scoperto'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

import { useEffect, useState, type FormEvent } from 'react'
import { addDays, format, isSameDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { DateField } from '@/shared/components/ui/DateField'
import { Dialog } from '@/shared/components/ui/Dialog'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { Select } from '@/shared/components/ui/Select'
import { TimeField } from '@/shared/components/ui/TimeField'
import { formatEuro } from '@/shared/lib/money'
import { localInputToDate, minToLabel, minutesOfDay } from '@/shared/lib/tz'
import { useClosureConflicts } from '../hooks/useClosureConflicts'
import { messageForClosureConflictsError, messageForClosureWrite } from '../utils/closureMessages'
import type { NewClosure } from '../hooks/useClosures'
import type { AdminField } from '../hooks/useAdminFields'

/**
 * One dialog, two parts that appear in order. The form comes first: pitch,
 * start, end, an optional reason. As soon as both instants are set, the
 * conflict preview appears below it — what `create_closure` would cancel,
 * read live through `useClosureConflicts` — so the manager sees the cost of
 * closing before they pay it, not after. Confirming is the only step that
 * writes anything.
 */
export function NewClosureDialog({ open, onClose, fields, create }: {
  open: boolean
  onClose: () => void
  fields: AdminField[]
  create: (input: NewClosure) => Promise<number>
}) {
  const [fieldId, setFieldId] = useState<string | null>(null)
  const [fromDate, setFromDate] = useState<Date | null>(null)
  const [fromMin, setFromMin] = useState(0)
  const [toDate, setToDate] = useState<Date | null>(null)
  const [toMin, setToMin] = useState(0)
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setFieldId(null)
    setFromDate(null)
    setFromMin(0)
    setToDate(null)
    setToMin(0)
    setReason('')
    setError(null)
  }, [open])

  // Recombines a `DateField`'s day and a `TimeField`'s minutes-from-midnight
  // into one instant, in Europe/Rome — through `localInputToDate`, the same
  // path the old `datetime-local` input used, rather than a fresh
  // `new Date(...)`. `1440` (24:00), a value a `TimeField` can legitimately
  // hold, has no valid 'HH:mm' spelling, so it reads as the next day's
  // midnight instead.
  function combine(date: Date, min: number): Date {
    const rolledDate = min === 1440 ? addDays(date, 1) : date
    const rolledMin = min === 1440 ? 0 : min
    return localInputToDate(`${format(rolledDate, 'yyyy-MM-dd')}T${minToLabel(rolledMin)}`)
  }

  const rawPeriod = fromDate && toDate
    ? { from: combine(fromDate, fromMin), to: combine(toDate, toMin) }
    : null

  // A period that ends before (or the same instant as) it starts cannot
  // exist: catching that here, before it becomes a query, is a form error
  // said in Italian, not a round trip to Postgres to find out.
  const periodInvalid = !!rawPeriod && rawPeriod.from >= rawPeriod.to
  const period = rawPeriod && !periodInvalid ? rawPeriod : null

  const { conflicts, isPending: conflictsPending, error: conflictsError } =
    useClosureConflicts(fieldId, period)

  // An unknown conflict list is not an empty one: none of these three states
  // — the period cannot exist, the preview is still running, the preview
  // failed — may be confirmed away.
  const canConfirm = !!period && !conflictsPending && !conflictsError

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!period || !canConfirm) return
    setError(null)
    setSaving(true)
    try {
      const cancelled = await create({ fieldId, from: period.from, to: period.to, reason })
      toast.success(
        cancelled === 0 ? 'Chiusura salvata.' : `Chiusura salvata. Disdette ${cancelled} prenotazioni.`)
      onClose()
    } catch (err) {
      setError(messageForClosureWrite(err))
    } finally {
      setSaving(false)
    }
  }

  function fieldName(id: string): string {
    return fields.find((f) => f.id === id)?.name ?? '—'
  }

  // Radix Select reserves the empty string internally to mean "nothing
  // selected" — an Item using it never shows its label in the trigger — so
  // "tutto l'impianto" needs a real, non-empty sentinel here.
  const ALL_FIELDS = 'tutto'
  const fieldOptions = [
    { value: ALL_FIELDS, label: "Tutto l'impianto" },
    ...fields.map((f) => ({ value: f.id, label: f.name })),
  ]

  return (
    <Dialog open={open} onClose={onClose} labelledBy="closure-form-title" size="wide">
      <form className="flex flex-col gap-3 p-4" onSubmit={handleSubmit}>
        <h3 id="closure-form-title" className="text-base font-semibold tracking-[-.01em]">
          Nuova chiusura
        </h3>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.06em] text-muted">Campo</span>
          <Select
            value={fieldId ?? ALL_FIELDS}
            onChange={(v) => setFieldId(v === ALL_FIELDS ? null : v)}
            options={fieldOptions}
          />
        </label>

        <div className="flex flex-wrap gap-3">
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[.06em] text-muted">Da</span>
            <div className="flex flex-wrap gap-2">
              <DateField
                value={fromDate}
                onChange={setFromDate}
                aria-label="Data di inizio"
              />
              <TimeField
                value={fromMin}
                onChange={setFromMin}
                aria-label="Ora di inizio"
              />
            </div>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[.06em] text-muted">A</span>
            <div className="flex flex-wrap gap-2">
              <DateField
                value={toDate}
                onChange={setToDate}
                min={fromDate ?? undefined}
                aria-label="Data di fine"
              />
              <TimeField
                value={toMin}
                onChange={setToMin}
                min={fromDate && toDate && isSameDay(fromDate, toDate) ? fromMin + 15 : undefined}
                aria-label="Ora di fine"
              />
            </div>
          </div>
        </div>

        {periodInvalid && (
          <ErrorNote message="Il periodo non è valido: la fine deve venire dopo l'inizio." />
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.06em] text-muted">Motivo (facoltativo)</span>
          <input
            type="text"
            className="field"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Es. tubo rotto, festività…"
          />
        </label>

        {period && (
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3">
            {conflictsPending ? (
              <p className="text-[12.5px] text-muted">Carico…</p>
            ) : conflictsError ? (
              // The preview never ran to a conclusion: this is not the same
              // thing as "zero conflicts", and must not be drawn as if it were.
              <ErrorNote message={messageForClosureConflictsError(conflictsError)} />
            ) : conflicts.length === 0 ? (
              <p className="text-[12.5px] text-muted">Nessuna prenotazione in questo periodo.</p>
            ) : (
              <>
                <p className="text-[12.5px] font-medium text-ink">
                  Chiudendo, queste {conflicts.length} prenotazioni verranno disdette.
                </p>
                <ul className="flex flex-col divide-y divide-line-soft">
                  {conflicts.map((c) => (
                    <li key={c.id} className="flex flex-col gap-0.5 py-2 text-[12.5px]">
                      <span className="text-ink">
                        {format(c.slot_start, 'EEE d MMM', { locale: it })}, {minToLabel(minutesOfDay(c.slot_start))}
                        {' · '}{fieldName(c.field_id)}
                      </span>
                      <span className="text-ink-2">
                        {c.member_name}
                        {c.member_phone ? ` · ${c.member_phone}` : ''} · {formatEuro(c.price_cents)}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="rounded-lg border border-terra bg-terra-tint px-3 py-2 text-[12.5px] text-terra">
                  I clienti non ricevono ancora un avviso: chiamali tu.
                </p>
              </>
            )}
          </div>
        )}

        <ErrorNote message={error} />

        <div className="flex justify-end gap-2 pt-0.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[7px] border border-line px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={saving || !canConfirm}
            className="rounded-[7px] bg-pitch px-3 py-1.5 text-[12.5px] font-medium text-on-pitch transition-colors hover:bg-pitch-strong"
          >
            {saving
              ? 'Salvo…'
              : conflictsPending
                ? 'Verifico…'
                : period && !conflictsError && conflicts.length > 0
                  ? `Chiudi e disdici ${conflicts.length} prenotazioni`
                  : 'Chiudi'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

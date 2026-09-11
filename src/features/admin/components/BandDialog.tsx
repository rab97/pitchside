import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { it } from 'date-fns/locale'
import { Dialog } from '@/shared/components/ui/Dialog'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { parseEuroToCents } from '@/shared/lib/money'
import { labelToMin, minToLabel } from '@/shared/lib/tz'
import { messageForBandWrite } from '../utils/bandMessages'
import type { Band } from '../utils/daySegments'
import type { SaveBandInput } from '../hooks/usePriceBands'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

export type BandFormTarget = { mode: 'create' } | { mode: 'edit'; band: Band }

/**
 * The one form behind every price band: seven weekday checkboxes plus a
 * start time, an end time and a euro price — a band is one idea ("lun-ven,
 * 18:00-20:00, 30 €") even though it lands as several rows underneath.
 * Editing pre-fills the checkboxes from the whole group of rows that share
 * the clicked band's hours and price, because that is the same group
 * `usePriceBands` reconstructs when it saves: what this form shows is what
 * actually gets replaced.
 */
export function BandDialog({ target, onClose, bands, saveBand, deleteBand }: {
  target: BandFormTarget | null
  onClose: () => void
  bands: Band[]
  saveBand: (input: SaveBandInput) => Promise<unknown>
  deleteBand: (bandIds: string[]) => Promise<unknown>
}) {
  const [weekdays, setWeekdays] = useState<number[]>([])
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [priceEuro, setPriceEuro] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Deliberately keyed on `target` alone, not on `bands`: a failed save
  // invalidates and refetches (see usePriceBands), which changes `bands`
  // while this dialog is still open. Resetting the form off that would
  // erase exactly the values a failed submit is supposed to leave in place.
  useEffect(() => {
    if (!target) return
    setError(null)
    if (target.mode === 'edit') {
      const { band } = target
      const group = bands.filter((b) =>
        b.startsMin === band.startsMin && b.endsMin === band.endsMin && b.priceCents === band.priceCents)
      setWeekdays(group.map((b) => b.weekday))
      setStartTime(minToLabel(band.startsMin))
      setEndTime(minToLabel(band.endsMin))
      setPriceEuro((band.priceCents / 100).toFixed(2))
    } else {
      setWeekdays([])
      setStartTime('')
      setEndTime('')
      setPriceEuro('')
    }
  }, [target])

  function toggleWeekday(w: number) {
    setWeekdays((ws) => (ws.includes(w) ? ws.filter((x) => x !== w) : [...ws, w].sort((a, b) => a - b)))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    // The exclusion constraint has nothing to say about an empty set of
    // weekdays — an insert of zero rows fails silently, not with 23514 or
    // 23P01 — so this one precondition is checked here, before the write.
    if (weekdays.length === 0) {
      setError('Scegli almeno un giorno della settimana.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await saveBand({
        id: target?.mode === 'edit' ? target.band.id : undefined,
        weekdays,
        startsMin: labelToMin(startTime),
        endsMin: labelToMin(endTime),
        priceCents: parseEuroToCents(priceEuro),
      })
      toast.success('Fascia salvata.')
      onClose()
    } catch (err) {
      setError(messageForBandWrite(err))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (target?.mode !== 'edit') return
    setError(null)
    setDeleting(true)
    try {
      const { band } = target
      const groupIds = bands
        .filter((b) =>
          b.startsMin === band.startsMin && b.endsMin === band.endsMin && b.priceCents === band.priceCents)
        .map((b) => b.id)
      await deleteBand(groupIds)
      toast.success('Fascia eliminata.')
      onClose()
    } catch (err) {
      setError(messageForBandWrite(err))
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Dialog open={!!target} onClose={onClose} labelledBy="band-form-title">
      <form className="flex flex-col gap-3 p-4" onSubmit={handleSubmit}>
        <h3 id="band-form-title" className="text-base font-semibold tracking-[-.01em]">
          {target?.mode === 'edit' ? 'Modifica fascia' : 'Nuova fascia'}
        </h3>

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.06em] text-muted">Giorni</span>
          <div className="flex flex-wrap gap-1.5">
            {WEEKDAYS.map((w) => {
              const label = it.localize?.day((w % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6, { width: 'abbreviated' }) ?? ''
              const checked = weekdays.includes(w)
              return (
                <label
                  key={w}
                  className={
                    'flex h-8 w-11 cursor-pointer items-center justify-center rounded-lg border text-[12px] transition-colors ' +
                    (checked
                      ? 'border-pitch bg-pitch-tint text-pitch'
                      : 'border-line bg-surface text-ink-2 hover:border-pitch')
                  }
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={checked}
                    onChange={() => toggleWeekday(w)}
                  />
                  {label}
                </label>
              )
            })}
          </div>
        </div>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[.06em] text-muted">Dalle</span>
            <input
              type="time"
              className="rounded-[7px] border border-line bg-surface-2 px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-pitch"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[.06em] text-muted">Alle</span>
            <input
              type="time"
              className="rounded-[7px] border border-line bg-surface-2 px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-pitch"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.06em] text-muted">Prezzo (€)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            className="rounded-[7px] border border-line bg-surface-2 px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-pitch"
            value={priceEuro}
            onChange={(e) => setPriceEuro(e.target.value)}
            required
          />
        </label>

        <ErrorNote message={error} />

        <div className="flex items-center justify-between gap-2 pt-0.5">
          {target?.mode === 'edit' ? (
            <button
              type="button"
              disabled={deleting || saving}
              onClick={handleDelete}
              className="rounded-[7px] border border-terra px-3 py-1.5 text-[12.5px] text-terra transition-colors hover:bg-terra-tint"
            >
              {deleting ? 'Elimino…' : 'Elimina'}
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[7px] border border-line px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={saving || deleting}
              className="rounded-[7px] bg-pitch px-3 py-1.5 text-[12.5px] font-medium text-on-pitch transition-colors hover:bg-pitch-strong"
            >
              {saving ? 'Salvo…' : 'Salva'}
            </button>
          </div>
        </div>
      </form>
    </Dialog>
  )
}

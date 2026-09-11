import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { it } from 'date-fns/locale'
import { Dialog } from '@/shared/components/ui/Dialog'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { TimeField } from '@/shared/components/ui/TimeField'
import { parseEuroToCents } from '@/shared/lib/money'
import { messageForBandWrite } from '../utils/bandMessages'
import type { Band } from '../utils/daySegments'
import type { SaveBandInput } from '../hooks/usePriceBands'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

export type BandFormTarget = { mode: 'create' } | { mode: 'edit'; band: Band }

/**
 * Thin shell around `BandForm`: its only job is to give the form a `key`
 * that changes with `target` — the band's id in edit mode, a fixed string in
 * create mode. That makes `BandForm` remount (not merely re-render) every
 * time the manager opens a different band, so its fields are born with the
 * right values instead of starting at their defaults and being corrected a
 * moment later by an effect.
 *
 * That correction-by-effect is what this replaced, and not just for
 * tidiness: a `TimeField` whose `value` changes right after it mounts — 0,
 * then 540 a render later — lost the second value here, back to its hidden
 * native `<select>` reporting `"0"` even though the state that fed it read
 * 540. Handing `TimeField` its true value from the first render, via a key
 * instead of a later `setState`, sidesteps whatever in Radix Select's mount
 * sequence produced that mismatch, rather than explaining it.
 */
export function BandDialog({ target, onClose, bands, saveBand, deleteBand }: {
  target: BandFormTarget | null
  onClose: () => void
  bands: Band[]
  saveBand: (input: SaveBandInput) => Promise<unknown>
  deleteBand: (bandIds: string[]) => Promise<unknown>
}) {
  return (
    <Dialog open={!!target} onClose={onClose} labelledBy="band-form-title">
      {target && (
        <BandForm
          key={target.mode === 'edit' ? target.band.id : 'create'}
          target={target}
          onClose={onClose}
          bands={bands}
          saveBand={saveBand}
          deleteBand={deleteBand}
        />
      )}
    </Dialog>
  )
}

/**
 * The one form behind every price band: seven weekday checkboxes plus a
 * start time, an end time and a euro price — a band is one idea ("lun-ven,
 * 18:00-20:00, 30 €") even though it lands as several rows underneath.
 * Editing pre-fills the checkboxes from the whole group of rows that share
 * the clicked band's hours and price, because that is the same group
 * `usePriceBands` reconstructs when it saves: what this form shows is what
 * actually gets replaced.
 *
 * Every field's initial value is read from `target` once, in the lazy
 * initializer each `useState` below is given — not in an effect — because
 * `BandDialog` above remounts this component whenever `target` changes to a
 * different band. A failed save still leaves the form as the manager left
 * it: `bands` refetching after an error changes the *prop*, not `target`
 * itself, so no remount happens and nothing here resets.
 */
function BandForm({ target, onClose, bands, saveBand, deleteBand }: {
  target: BandFormTarget
  onClose: () => void
  bands: Band[]
  saveBand: (input: SaveBandInput) => Promise<unknown>
  deleteBand: (bandIds: string[]) => Promise<unknown>
}) {
  const [weekdays, setWeekdays] = useState<number[]>(() => {
    if (target.mode !== 'edit') return []
    const { band } = target
    return bands
      .filter((b) =>
        b.startsMin === band.startsMin && b.endsMin === band.endsMin && b.priceCents === band.priceCents)
      .map((b) => b.weekday)
  })
  // `null`, not `0`, when nothing is chosen yet: `0` is `00:00`, a real,
  // submittable time — see the comment on `TimeField`.
  const [startMin, setStartMin] = useState<number | null>(() => (target.mode === 'edit' ? target.band.startsMin : null))
  const [endMin, setEndMin] = useState<number | null>(() => (target.mode === 'edit' ? target.band.endsMin : null))
  const [priceEuro, setPriceEuro] = useState(() =>
    target.mode === 'edit' ? (target.band.priceCents / 100).toFixed(2) : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

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
    // A `TimeField` left untouched is unset, not midnight — `startMin`/
    // `endMin` only read `0` when the manager actually chose `00:00`, so
    // this is the one check that keeps an untouched field from saving as
    // if it had been.
    if (startMin == null || endMin == null) {
      setError('Scegli l’ora di inizio e l’ora di fine.')
      return
    }
    setError(null)
    setSaving(true)
    try {
      await saveBand({
        id: target.mode === 'edit' ? target.band.id : undefined,
        weekdays,
        startsMin: startMin,
        endsMin: endMin,
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

  function requestDelete() {
    setError(null)
    setConfirmingDelete(true)
  }

  async function handleDelete() {
    if (target.mode !== 'edit') return
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
    <form className="flex flex-col gap-3 p-4" onSubmit={handleSubmit}>
      <h3 id="band-form-title" className="text-base font-semibold tracking-[-.01em]">
        {target.mode === 'edit' ? 'Modifica fascia' : 'Nuova fascia'}
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
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.06em] text-muted">Dalle</span>
          <TimeField
            value={startMin}
            onChange={setStartMin}
            min={0}
            max={1425}
            aria-label="Dalle"
          />
        </div>
        <div className="flex flex-1 flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.06em] text-muted">Alle</span>
          <TimeField
            value={endMin}
            onChange={setEndMin}
            min={startMin == null ? undefined : startMin + 15}
            max={1440}
            aria-label="Alle"
          />
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[.06em] text-muted">Prezzo (€)</span>
        <input
          type="number"
          min="0"
          step="0.01"
          inputMode="decimal"
          className="field"
          value={priceEuro}
          onChange={(e) => setPriceEuro(e.target.value)}
          required
        />
      </label>

      <ErrorNote message={error} />

      {confirmingDelete ? (
        // Removing a group takes down every day it made bookable — up to
        // seven rows in one click — and is the only destructive action on
        // this screen with no guard before this. `ClosuresPage`'s delete
        // confirmation is the register this borrows.
        <div className="rounded-lg border border-terra bg-terra-tint p-3 text-[12.5px] text-terra">
          Eliminando questa fascia il campo chiude in quei giorni, finché non ne aggiungi un’altra.
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-[7px] border border-line px-3 py-1.5 text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={handleDelete}
              className="rounded-[7px] bg-terra px-3 py-1.5 font-medium text-on-terra transition-colors hover:bg-terra-strong"
            >
              {deleting ? 'Elimino…' : 'Conferma l’eliminazione'}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          {target.mode === 'edit' ? (
            <button
              type="button"
              disabled={deleting || saving}
              onClick={requestDelete}
              className="rounded-[7px] border border-terra px-3 py-1.5 text-[12.5px] text-terra transition-colors hover:bg-terra-tint"
            >
              Elimina
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
      )}
    </form>
  )
}

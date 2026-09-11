import { useEffect, useState, type FormEvent } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { Dialog } from '@/shared/components/ui/Dialog'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { formatEuro } from '@/shared/lib/money'
import { localInputToDate } from '@/shared/lib/tz'
import { useClosureConflicts } from '../hooks/useClosureConflicts'
import { messageForClosureWrite } from '../utils/closureMessages'
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
  const [fromStr, setFromStr] = useState('')
  const [toStr, setToStr] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setFieldId(null)
    setFromStr('')
    setToStr('')
    setReason('')
    setError(null)
  }, [open])

  const period = fromStr && toStr
    ? { from: localInputToDate(fromStr), to: localInputToDate(toStr) }
    : null

  const { conflicts, isPending: conflictsPending } = useClosureConflicts(fieldId, period)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!period) return
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

  return (
    <Dialog open={open} onClose={onClose} labelledBy="closure-form-title">
      <form className="flex flex-col gap-3 p-4" onSubmit={handleSubmit}>
        <h3 id="closure-form-title" className="text-base font-semibold tracking-[-.01em]">
          Nuova chiusura
        </h3>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.06em] text-muted">Campo</span>
          <select
            className="rounded-[7px] border border-line bg-surface-2 px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-pitch"
            value={fieldId ?? ''}
            onChange={(e) => setFieldId(e.target.value || null)}
          >
            <option value="">Tutto l'impianto</option>
            {fields.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[.06em] text-muted">Da</span>
            <input
              type="datetime-local"
              className="rounded-[7px] border border-line bg-surface-2 px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-pitch"
              value={fromStr}
              onChange={(e) => setFromStr(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-[11px] uppercase tracking-[.06em] text-muted">A</span>
            <input
              type="datetime-local"
              className="rounded-[7px] border border-line bg-surface-2 px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-pitch"
              value={toStr}
              onChange={(e) => setToStr(e.target.value)}
              required
            />
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.06em] text-muted">Motivo (facoltativo)</span>
          <input
            type="text"
            className="rounded-[7px] border border-line bg-surface-2 px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-pitch"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Es. tubo rotto, festività…"
          />
        </label>

        {period && (
          <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-3">
            {conflictsPending ? (
              <p className="text-[12.5px] text-muted">Carico…</p>
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
                        {format(c.slot_start, "EEE d MMM, HH:mm", { locale: it })} · {fieldName(c.field_id)}
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
            disabled={saving}
            className="rounded-[7px] bg-pitch px-3 py-1.5 text-[12.5px] font-medium text-on-pitch transition-colors hover:bg-pitch-strong"
          >
            {saving
              ? 'Salvo…'
              : conflicts.length === 0
                ? 'Chiudi'
                : `Chiudi e disdici ${conflicts.length} prenotazioni`}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

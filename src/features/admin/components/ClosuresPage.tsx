import { useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { Dialog } from '@/shared/components/ui/Dialog'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { minToLabel, minutesOfDay } from '@/shared/lib/tz'
import { useAdminFields } from '../hooks/useAdminFields'
import { useClosures, type Closure } from '../hooks/useClosures'
import { messageForClosureDelete } from '../utils/closureMessages'
import { NewClosureDialog } from './NewClosureDialog'
import { SettingsPage } from './SettingsPage'

// `format` alone renders in the device's own zone; a manager reading this
// list off their phone must see the same hour they typed in Rome. Splitting
// the date from `minutesOfDay`/`minToLabel` is the convention the rest of
// the app already follows — see `BookingCell`, `BookingPage`, `MyBookingsPage`.
function instantLabel(d: Date): string {
  return `${format(d, 'EEE d MMM', { locale: it })}, ${minToLabel(minutesOfDay(d))}`
}

function periodLabel(closure: Closure): string {
  return `${instantLabel(closure.starts_at)} – ${instantLabel(closure.ends_at)}`
}

function ClosureRow({ closure, onDelete }: { closure: Closure; onDelete?: () => void }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 p-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13.5px] font-medium text-ink">
          {closure.field_name ?? "Tutto l'impianto"}
        </span>
        <span className="text-[12px] text-muted">{periodLabel(closure)}</span>
        {closure.reason && <span className="text-[12px] text-ink-2">{closure.reason}</span>}
      </div>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          className="rounded-[7px] border border-line px-2.5 py-1 text-[12px] text-ink-2 transition-colors hover:border-terra hover:text-terra"
        >
          Elimina
        </button>
      )}
    </li>
  )
}

/**
 * A closure is the event that turns a period unbookable and, when it
 * overlaps existing bookings, cancels them in the same transaction — see
 * `create_closure` (Task 2). This screen only lists what already happened
 * and offers the two things left to do around it: create a new one, through
 * `NewClosureDialog`'s preview-then-confirm, and remove an upcoming one,
 * which reopens the period without touching what it already cancelled.
 */
export function ClosuresPage() {
  const { fields } = useAdminFields()
  const { upcoming, past, isPending, error, create, remove } = useClosures()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deletingClosure, setDeletingClosure] = useState<Closure | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!deletingClosure) return
    setDeleteError(null)
    setDeleting(true)
    try {
      await remove(deletingClosure.id)
      toast.success('Chiusura eliminata.')
      setDeletingClosure(null)
    } catch (e) {
      setDeleteError(messageForClosureDelete(e))
    } finally {
      setDeleting(false)
    }
  }

  const isEmpty = !isPending && !error && upcoming.length === 0 && past.length === 0

  return (
    <SettingsPage title="Chiusure">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="rounded-[7px] bg-pitch px-3 py-1.5 text-[12.5px] font-medium text-on-pitch transition-colors hover:bg-pitch-strong"
        >
          Aggiungi chiusura
        </button>
      </div>

      <ErrorNote message={error ? 'Non siamo riusciti a caricare le chiusure. Riprova.' : null} />

      {isPending ? (
        <p className="text-[13px] text-muted">Carico…</p>
      ) : isEmpty ? (
        <p className="text-[13px] text-muted">
          Nessuna chiusura. L'impianto è aperto negli orari delle tariffe.
        </p>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-[13px] font-medium text-ink-2">Prossime</h2>
              <ul className="flex flex-col divide-y divide-line-soft rounded-card border border-line bg-surface shadow-card">
                {upcoming.map((c) => (
                  <ClosureRow key={c.id} closure={c} onDelete={() => { setDeleteError(null); setDeletingClosure(c) }} />
                ))}
              </ul>
            </div>
          )}

          {past.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-[13px] font-medium text-ink-2">Passate</h2>
              <ul className="flex flex-col divide-y divide-line-soft rounded-card border border-line bg-surface shadow-card">
                {past.map((c) => (
                  <ClosureRow key={c.id} closure={c} />
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <NewClosureDialog open={dialogOpen} onClose={() => setDialogOpen(false)} fields={fields} create={create} />

      <Dialog open={!!deletingClosure} onClose={() => setDeletingClosure(null)} labelledBy="delete-closure-title">
        <div className="flex flex-col gap-3 p-4">
          <h3 id="delete-closure-title" className="text-base font-semibold tracking-[-.01em]">
            Eliminare questa chiusura?
          </h3>
          <p className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-ink-2">
            Il periodo torna prenotabile. Le prenotazioni già disdette non tornano indietro.
          </p>
          <ErrorNote message={deleteError} />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeletingClosure(null)}
              className="rounded-[7px] border border-line px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
            >
              Annulla
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={confirmDelete}
              className="rounded-[7px] border border-terra px-3 py-1.5 text-[12.5px] text-terra transition-colors hover:bg-terra-tint"
            >
              {deleting ? 'Elimino…' : 'Elimina'}
            </button>
          </div>
        </div>
      </Dialog>
    </SettingsPage>
  )
}

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { Dialog } from '@/shared/components/ui/Dialog'
import { formatEuro } from '@/shared/lib/money'
import { dayKey, minToLabel } from '@/shared/lib/tz'
import { useMyMember } from '@/features/auth/hooks/useMyMember'
import type { FieldRow } from '@/shared/hooks/useFields'
import { fieldKind } from '../utils/fieldKind'
import { useBookAsMember } from '../hooks/useBookAsMember'

function durationLabel(minutes: number): string {
  return minutes === 60 ? '1h' : minutes === 90 ? '1h 30' : '2h'
}

/**
 * Il momento in cui la scelta diventa una prenotazione vera: campo, giorno,
 * orario, durata e quanto si paga in struttura, per come li ha già prezzati
 * `slot_prices` — nessun calcolo qui. Si apre solo a scelta completa e con
 * un membro esistente (BookPage garantisce entrambi prima di montarla aperta).
 */
export function ConfirmBookingDialog({
  open, onClose, onBooked, field, day, startMin, minutes, price, cancelDeadline,
}: {
  open: boolean
  onClose: () => void
  /** Chiamata in più rispetto a `onClose`, solo dopo una prenotazione
   *  riuscita: BookPage la usa per svuotare l'orario scelto, così l'aside
   *  non resta a proporre di riconfermare uno slot appena preso. */
  onBooked?: () => void
  field: FieldRow | null
  day: Date
  startMin: number | null
  minutes: number
  price: number | null
  cancelDeadline: Date | null
}) {
  const { memberId, isPending: memberPending } = useMyMember()
  const book = useBookAsMember()
  const [error, setError] = useState<string | null>(null)

  // Un errore di un tentativo precedente (un altro slot, un'altra apertura
  // del riepilogo) non deve restare visibile su una scelta nuova.
  useEffect(() => {
    setError(null)
  }, [open, field?.id, startMin, day, minutes])

  if (!open || !field || startMin == null) return null

  async function confirm() {
    if (!field || startMin == null || !memberId) return
    setError(null)
    try {
      await book.mutateAsync({
        fieldId: field.id,
        day: dayKey(day),
        startMin,
        minutes,
        memberId,
      })
      toast.success(
        `Prenotato: ${format(day, 'EEE d MMM', { locale: it })} · ` +
        `${minToLabel(startMin)}–${minToLabel(startMin + minutes)}` +
        (price != null ? ` · ${formatEuro(price)}` : ''),
      )
      onBooked?.()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La prenotazione non è riuscita. Riprova.')
    }
  }

  const disabled = book.isPending || memberPending || !memberId

  return (
    <Dialog open={open} onClose={onClose} labelledBy="confirm-title">
      <div className="flex flex-col gap-3.5 p-4">
        <h3 id="confirm-title" className="text-base font-semibold tracking-[-.01em]">
          Conferma
        </h3>

        <div>
          <p className="text-[15px] font-medium">
            {format(day, 'EEE d MMM', { locale: it })} ·{' '}
            <span className="tabular-nums">{minToLabel(startMin)}</span>
          </p>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {field.name} · calcio {fieldKind(field.kind)}
          </p>
        </div>

        <dl className="flex flex-col gap-1.5 rounded-lg border border-line-soft bg-surface-2 px-3 py-2.5 text-[13px]">
          <div className="flex justify-between">
            <dt className="text-muted">Durata</dt>
            <dd className="font-medium">{durationLabel(minutes)}</dd>
          </div>
          <div className="flex justify-between border-t border-line-soft pt-1.5">
            <dt className="text-muted">Totale</dt>
            <dd className="tabular-nums font-semibold">
              {price != null ? formatEuro(price) : '—'}
            </dd>
          </div>
        </dl>

        <p className="text-[11.5px] leading-[1.5] text-muted">
          Si paga in struttura.
          {cancelDeadline
            ? ` Puoi disdire gratis fino a ${format(cancelDeadline, 'EEE d MMM', { locale: it })} alle ${format(cancelDeadline, 'HH:mm')}.`
            : ''}
        </p>

        {error && (
          <p role="alert" className="rounded-lg border border-terra bg-terra-tint px-3 py-2 text-[12.5px] text-terra">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-0.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3.5 py-2 text-[13px] text-ink-2"
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={disabled}
            className="rounded-lg bg-pitch px-4 py-2 text-[13px] font-medium text-white disabled:opacity-50"
          >
            {book.isPending ? 'Confermo…' : 'Conferma'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

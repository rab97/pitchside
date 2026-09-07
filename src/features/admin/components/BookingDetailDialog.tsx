import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { Dialog } from '@/shared/components/ui/Dialog'
import { formatEuro } from '@/shared/lib/money'
import { minToLabel, minutesOfDay } from '@/shared/lib/tz'
import { CancelBookingError, isLateCancel, useCancelBooking } from '@/shared/hooks/useCancelBooking'
import type { BookingRow } from '../hooks/useDayBookings'
import { messageForError } from '../utils/cancelBookingMessage'

const SOURCE_LABEL: Record<string, string> = {
  phone: 'Telefonata',
  app: 'Dall’app',
  admin: 'Inserita dal gestore',
  recurrence: 'Fisso settimanale',
  tournament: 'Torneo',
}

function Kv({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-line-soft py-2 text-[12.5px]">
      <span className="text-muted">{label}</span>
      <b className="text-right font-medium">{children}</b>
    </div>
  )
}

export function BookingDetailDialog({ booking, fieldName, onClose }: {
  booking: BookingRow | null
  fieldName: string | undefined
  onClose: () => void
}) {
  const cancel = useCancelBooking()
  const [confirming, setConfirming] = useState(false)

  useEffect(() => { setConfirming(false) }, [booking])

  if (!booking) return <Dialog open={false} onClose={onClose}>{null}</Dialog>

  const deadline = new Date(booking.cancel_deadline)
  const late = isLateCancel(deadline, new Date())

  async function doCancel() {
    if (!booking) return
    try {
      await cancel.mutateAsync({ id: booking.id })
      toast.success(`Disdetta: ${booking.member_name}. Lo slot è di nuovo libero.`)
      onClose()
    } catch (e) {
      toast.error(messageForError(e instanceof CancelBookingError ? e.code : ''))
    }
  }

  return (
    <Dialog open onClose={onClose} labelledBy="bd-title">
      <div className="flex flex-col gap-3 p-4">
        <p className="tabular-nums text-[11px] tracking-[.03em] text-muted">
          {(fieldName ?? '').toUpperCase()} · {format(booking.slot_start, 'EEE d MMM', { locale: it }).toUpperCase()}
        </p>
        <h3 id="bd-title" className="text-base font-semibold tracking-[-.01em]">
          {minToLabel(minutesOfDay(booking.slot_start))} – {minToLabel(minutesOfDay(booking.slot_end))}
        </h3>

        <div>
          <Kv label="Prenotata da">{booking.member_name}</Kv>
          {booking.member_phone && (
            <Kv label="Telefono">
              <a className="tabular-nums text-pitch" href={`tel:${booking.member_phone}`}>
                {booking.member_phone}
              </a>
            </Kv>
          )}
          <Kv label="Da incassare in struttura">{formatEuro(booking.price_cents)}</Kv>
          <Kv label="Origine">{SOURCE_LABEL[booking.source] ?? booking.source}</Kv>
          <Kv label="Disdetta gratuita entro">
            <span className={late ? 'text-terra' : undefined}>
              {format(deadline, "EEE d MMM, HH:mm", { locale: it })}
              {late ? ' · scaduta' : ''}
            </span>
          </Kv>
        </div>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="w-full rounded-lg border border-terra py-2 text-sm text-terra"
          >
            Disdici la prenotazione
          </button>
        ) : (
          <div className="rounded-lg border border-terra bg-terra-tint p-3 text-[12.5px] text-terra">
            {late
              ? 'Siamo oltre il termine di disdetta: la prenotazione risulterà come mancata presenza e inciderà sull’affidabilità del cliente.'
              : 'Il campo torna subito libero per gli altri e il cliente non paga nulla.'}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="rounded-[7px] border border-line px-3 py-1.5 text-ink-2"
              >
                Annulla
              </button>
              <button
                type="button"
                disabled={cancel.isPending}
                onClick={doCancel}
                className="rounded-[7px] bg-terra px-3 py-1.5 font-medium text-white disabled:opacity-50"
              >
                {cancel.isPending ? 'Disdico…' : 'Conferma la disdetta'}
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="self-end text-[12.5px] text-muted"
        >
          Chiudi
        </button>
      </div>
    </Dialog>
  )
}

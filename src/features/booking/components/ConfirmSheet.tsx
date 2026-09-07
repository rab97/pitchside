import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { formatEuro } from '@/shared/lib/money'
import { minToLabel } from '@/shared/lib/tz'
import type { FieldRow } from '@/shared/hooks/useFields'
import { SLOT_GONE } from '../utils/messages'
import { CancelNote, SummaryRows } from './BookingSummary'

/**
 * Il foglio di conferma su telefono: appare in basso appena si sceglie un
 * orario, chiuso mostra giorno, ora, importo e «Conferma», e si apre verso
 * l'alto sul dettaglio.
 *
 * È il seguito di `.pcta` del mockup (`docs/mockups/02-catalogo-schermate.html`,
 * riga 240), che era una barra sola: qui la barra diventa anche la maniglia
 * del dettaglio, perché su un telefono il riepilogo a fianco non c'è e quelle
 * righe devono poter comparire da qualche parte.
 *
 * Perché una barra fissa e non lo scorrimento fino alla card: la card sta in
 * fondo alla pagina, quindi scelto un orario bisognava portarci la pagina, e
 * un'ancora che si muove da sé sposta lo schermo sotto le dita di chi stava
 * ancora leggendo l'elenco. Il pulsante che arriva da sé non sposta niente.
 *
 * L'importo è visibile **chiuso**, non solo aperto: si conferma una spesa, e
 * chiedere di aprire un dettaglio per sapere quanto si paga è il modo di far
 * premere alla cieca.
 *
 * Si appoggia sopra la barra dei tab invece di coprirla (`bottom` somma
 * `--spacing-tabbar` e l'incavo di sicurezza): una barra dei tab che scompare
 * a metà scelta si legge come un guasto, e chi cambia idea deve poter andare
 * altrove senza prima chiudere qualcosa.
 *
 * Aperto oscura la pagina dietro, e il velo è anche il modo di richiudere:
 * chi apre un foglio in basso su un telefono tocca fuori per chiuderlo prima
 * di cercare un pulsante. Restano la maniglia e Esc. Il trascinamento col
 * dito no: è lavoro sui gesti che non è in questo giro, e prometterlo a metà
 * sarebbe peggio che non averlo.
 *
 * Da `lg` in su non esiste: lì il riepilogo è la card a fianco dell'elenco.
 */
export function ConfirmSheet({
  field, day, startMin, minutes, price, cancelDeadline, disabled, onConfirm,
}: {
  field: FieldRow
  day: Date
  startMin: number
  minutes: number
  price: number | null
  cancelDeadline: Date | null
  disabled: boolean
  onConfirm: () => void
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      {open && (
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-black/35 lg:hidden"
        />
      )}

      <div className="fixed inset-x-0 bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] z-40 rounded-t-card border-t border-line bg-surface shadow-card lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="confirm-sheet-detail"
          aria-label={open ? 'Chiudi il dettaglio' : 'Mostra il dettaglio'}
          onClick={() => setOpen((v) => !v)}
          className="flex w-full flex-col items-center gap-1.5 px-4 pt-2 pb-1"
        >
          <span aria-hidden className="h-1 w-9 rounded-full bg-line" />
          <span className="w-full text-left text-[14px] font-semibold tracking-[-.01em]">
            {format(day, 'EEE d MMM', { locale: it })} ·{' '}
            <span className="tabular-nums">{minToLabel(startMin)}</span>–
            <span className="tabular-nums">{minToLabel(startMin + minutes)}</span>
          </span>
        </button>

        <div
          id="confirm-sheet-detail"
          className={
            'px-4 transition-[max-height] duration-200 ease-out motion-reduce:transition-none ' +
            (open ? 'max-h-[55vh] overflow-y-auto' : 'max-h-0 overflow-hidden')
          }
        >
          <div className="flex flex-col gap-2.5 pt-2 pb-1">
            <SummaryRows field={field} minutes={minutes} price={price} />
            <CancelNote cancelDeadline={cancelDeadline} />
          </div>
        </div>

        {price == null && (
          <p className="px-4 pt-1 text-[12.5px] text-terra">{SLOT_GONE}</p>
        )}

        <div className="flex items-center gap-3 px-4 pt-1.5 pb-3">
          <span className="tabular-nums text-[17px] font-semibold">
            {price != null ? formatEuro(price) : '—'}
          </span>
          <button
            type="button"
            disabled={disabled}
            onClick={onConfirm}
            className="ml-auto rounded-lg bg-pitch px-6 py-2.5 text-sm font-medium text-on-pitch transition-colors hover:bg-pitch-strong"
          >
            Conferma
          </button>
        </div>
      </div>
    </>
  )
}

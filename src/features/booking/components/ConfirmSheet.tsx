import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { formatEuro } from '@/shared/lib/money'
import { minToLabel } from '@/shared/lib/tz'
import type { FieldRow } from '@/shared/hooks/useFields'
import { SLOT_GONE } from '../utils/messages'
import { heightWhileDragging, settleDrag } from '../utils/sheetDrag'
import { CancelNote, SummaryRows } from './BookingSummary'

// Oltre questa frazione dello schermo il dettaglio non cresce più: si scorre
// dentro di sé. Serve solo ai fogli molto alti — con la nota della disdetta e
// un avviso siamo intorno ai 150px — ma senza, su un telefono basso, il
// foglio aperto coprirebbe l'elenco che si stava guardando.
const MAX_SHARE_OF_SCREEN = 0.55

// Sotto questa distanza il gesto è un tocco e non un trascinamento: è la
// tolleranza della mano che preme, non un gesto vero.
const TAP_SLOP = 4

/**
 * Il foglio di conferma su telefono: appare in basso appena si sceglie un
 * orario, chiuso mostra giorno, ora, importo e «Conferma», e si apre verso
 * l'alto sul dettaglio — toccando la maniglia o trascinandola, come i fogli
 * di sistema.
 *
 * È il seguito di `.pcta` del mockup (`docs/mockups/02-catalogo-schermate.html`,
 * riga 240), che era una barra sola: qui la barra diventa anche la maniglia
 * del dettaglio, perché su un telefono il riepilogo a fianco non c'è e quelle
 * righe devono poter comparire da qualche parte.
 *
 * L'altezza animata è quella **misurata** del contenuto, non un tetto in
 * `vh`. Con un tetto la stessa animazione si vedeva solo in chiusura: il
 * contenuto è alto ~120px e il tetto era 55vh, quindi in apertura appena
 * `max-height` superava 120 il dettaglio era già tutto visibile e i pixel
 * restanti scorrevano a vuoto, mentre in chiusura il tratto visibile era
 * tutto. Misurare rende l'apertura e la chiusura lo stesso gesto al
 * contrario, ed è anche ciò che permette al foglio di seguire il dito, che ha
 * bisogno di un valore continuo e non di due stati.
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
 * di cercare un pulsante. Restano la maniglia, il trascinamento e Esc.
 *
 * Il velo ascolta `pointerdown` e non `click`, e porta `cursor-pointer`: su
 * iOS il primo tocco su un `<div>` che il browser non considera cliccabile
 * non diventa un click, e per chiudere il foglio servivano **due** tocchi
 * fuori. `pointerdown` arriva al primo, su qualunque dispositivo, e chiude
 * appena il dito appoggia invece di aspettare che si stacchi.
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
  // L'altezza mentre il dito si muove. `null` vuol dire «nessun
  // trascinamento in corso», ed è anche il modo di sapere se l'animazione
  // deve essere accesa: durante il gesto no, il foglio segue il dito.
  const [dragHeight, setDragHeight] = useState<number | null>(null)
  const [travel, setTravel] = useState(0)

  const contentRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ startY: number; base: number; moved: boolean } | null>(null)
  // Un trascinamento finisce anche con un `click`, che altrimenti invertirebbe
  // subito quello che il gesto ha appena deciso.
  const skipClickRef = useRef(false)

  // La corsa è l'altezza del contenuto, misurata: cambia col contenuto (la
  // nota della disdetta, l'avviso di orario scaduto) e con la rotazione dello
  // schermo, quindi si osserva invece di leggerla una volta.
  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const measure = () => setTravel(
      Math.min(el.scrollHeight, Math.round(window.innerHeight * MAX_SHARE_OF_SCREEN)))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function onPointerDown(e: ReactPointerEvent<HTMLButtonElement>) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    dragRef.current = { startY: e.clientY, base: open ? travel : 0, moved: false }
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onPointerMove(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag) return
    const dy = e.clientY - drag.startY
    if (!drag.moved && Math.abs(dy) > TAP_SLOP) drag.moved = true
    if (drag.moved) {
      setDragHeight(heightWhileDragging({ base: drag.base, dy, travel }))
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    setDragHeight(null)
    // Mano ferma: è un tocco, e a invertire ci pensa `onClick`.
    if (!drag.moved) return

    skipClickRef.current = true
    const outcome = settleDrag({ dy: e.clientY - drag.startY, travel })
    if (outcome !== 'unchanged') setOpen(outcome === 'open')
  }

  function onPointerCancel() {
    if (!dragRef.current) return
    dragRef.current = null
    setDragHeight(null)
  }

  function onClick() {
    if (skipClickRef.current) {
      skipClickRef.current = false
      return
    }
    setOpen((v) => !v)
  }

  const dragging = dragHeight != null
  const height = dragHeight ?? (open ? travel : 0)

  return (
    <>
      {open && (
        <div
          aria-hidden
          onPointerDown={() => setOpen(false)}
          className="fixed inset-0 z-30 cursor-pointer bg-black/35 lg:hidden"
        />
      )}

      <div className="fixed inset-x-0 bottom-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] z-40 rounded-t-card border-t border-line bg-surface shadow-card lg:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="confirm-sheet-detail"
          aria-label={open ? 'Chiudi il dettaglio' : 'Mostra il dettaglio'}
          onClick={onClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          // `touch-none`: senza, il browser prende il gesto verticale per uno
          // scorrimento (o per un «tira per aggiornare») e il foglio resta
          // fermo mentre la pagina sotto si muove.
          className="flex w-full touch-none flex-col items-center gap-1.5 px-4 pt-2 pb-1 select-none"
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
          style={{ maxHeight: `${height}px` }}
          className={
            'px-4 ' +
            (dragging
              ? 'overflow-hidden'
              : 'transition-[max-height] duration-200 ease-out motion-reduce:transition-none ' +
                (open ? 'overflow-y-auto' : 'overflow-hidden'))
          }
        >
          <div ref={contentRef} className="flex flex-col gap-2.5 pt-2 pb-1">
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

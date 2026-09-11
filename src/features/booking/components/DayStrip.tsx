import { useEffect, useState } from 'react'
import { addDays, format, isSameDay, startOfDay } from 'date-fns'
import { it } from 'date-fns/locale'
import { DateJump } from '@/shared/components/ui/DateJump'
import { monthLabel } from '../utils/monthLabel'

/**
 * Una riga di sette giorni cliccabili, come `.daystrip` nel mockup
 * (`docs/mockups/02-catalogo-schermate.html`, riga 212). Le frecce spostano
 * la finestra di sette giorni alla volta, non uno: è il limite notato nella
 * griglia del gestore (vedi memoria `navigazione-data-rimandata`), qui evitato
 * fin da subito perché l'orizzonte di prenotazione arriva oltre una settimana.
 *
 * `horizonDays` si conta in giorni interi, e l'ultimo giorno resta
 * selezionabile: `create_booking` però confronta istanti, quindi di quel
 * giorno è prenotabile solo la parte fino all'ora in cui siamo adesso. A
 * escludere le partenze oltre il limite ci pensa `BookPage`, che passa
 * `maxStartMin` a `freeSlots` — qui si sceglie un giorno, non un orario, e
 * togliere l'ultimo giorno per intero butterebbe le ore ancora buone.
 */
export function DayStrip({ day, onSelect, horizonDays }: {
  day: Date
  onSelect: (d: Date) => void
  horizonDays: number
}) {
  const today = startOfDay(new Date())
  const lastBookable = addDays(today, horizonDays)
  const [windowStart, setWindowStart] = useState(() => startOfDay(day))

  // La finestra segue `day` solo quando ci cade fuori — scelto lontano dal
  // `DateJump` qui sotto, o ripristinato da `BookPage` dopo l'accesso.
  // Aggiornare `windowStart` a ogni ridisegno introdurrebbe il difetto
  // opposto: sfogliare con le frecce cambia solo `windowStart`, non `day`, e
  // se l'effetto si riallineasse comunque l'utente non potrebbe più
  // allontanarsi dalla settimana di `day` per guardare le altre. Per questo
  // le dipendenze sono solo `day`, e il confronto con la finestra corrente
  // passa dall'aggiornamento funzionale di `setWindowStart`, non da
  // `windowStart` letto qui fuori: così l'effetto non ha bisogno di
  // dichiararlo fra le dipendenze per restare corretto.
  useEffect(() => {
    const target = startOfDay(day)
    setWindowStart((w) => {
      const end = addDays(w, 6)
      return target < w || target > end ? target : w
    })
  }, [day])

  const days = Array.from({ length: 7 }, (_, i) => addDays(windowStart, i))
  const canGoBack = windowStart > today
  const canGoForward = addDays(windowStart, 7) <= lastBookable

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[.06em] text-muted">
          {monthLabel(windowStart)}
        </span>
        <DateJump
          min={format(today, 'yyyy-MM-dd')}
          max={format(lastBookable, 'yyyy-MM-dd')}
          onSelect={onSelect}
          label="Vai a una data"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Settimana precedente"
          disabled={!canGoBack}
          onClick={() => setWindowStart((w) => addDays(w, -7))}
          className="grid h-8 w-6 shrink-0 place-items-center rounded-md border border-line bg-surface text-xs text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
        >
          ‹
        </button>

        <div className="flex flex-1 gap-1.5">
          {days.map((d) => {
            const selected = isSameDay(d, day)
            const bookable = d <= lastBookable
            return (
              <button
                key={d.toISOString()}
                type="button"
                disabled={!bookable}
                onClick={() => onSelect(d)}
                aria-pressed={selected}
                className={
                  'flex-1 rounded-lg border py-1.5 text-center transition ' +
                  (selected
                    ? 'border-pitch bg-pitch text-on-pitch'
                    : 'border-line bg-surface text-ink-2 hover:border-pitch')
                }
              >
                <span className="block text-[10px] uppercase tracking-[.06em] opacity-80">
                  {format(d, 'EEE', { locale: it })}
                </span>
                <span className="mt-0.5 block tabular-nums text-[13px] font-medium">
                  {format(d, 'd')}
                </span>
              </button>
            )
          })}
        </div>

        <button
          type="button"
          aria-label="Settimana successiva"
          disabled={!canGoForward}
          onClick={() => setWindowStart((w) => addDays(w, 7))}
          className="grid h-8 w-6 shrink-0 place-items-center rounded-md border border-line bg-surface text-xs text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
        >
          ›
        </button>
      </div>
    </div>
  )
}

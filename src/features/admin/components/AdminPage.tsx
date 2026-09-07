import { useState } from 'react'
import { addDays, format, isToday } from 'date-fns'
import { it } from 'date-fns/locale'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useFields } from '@/shared/hooks/useFields'
import { DayGrid } from './DayGrid'
import type { BookingRow } from '../hooks/useDayBookings'
import { BookingDetailDialog } from './BookingDetailDialog'
import { NewBookingDialog, type NewBookingTarget } from './NewBookingDialog'

export function AdminPage() {
  const facility = useFacility()
  const [day, setDay] = useState<Date>(() => new Date())
  const [selected, setSelected] = useState<BookingRow | null>(null)
  const [target, setTarget] = useState<NewBookingTarget | null>(null)
  const fields = useFields()

  return (
    <div className="min-h-screen bg-ground p-4 sm:p-6">
      <div className="mx-auto max-w-[1140px]">
        <p className="tabular-nums text-[11px] uppercase tracking-[.14em] text-pitch">
          {facility.name}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-.02em]">
          Giornata
        </h1>

        <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-surface-2 px-3.5 py-3">
            <span className="inline-flex items-center gap-1.5 tabular-nums text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-pitch" />
              in tempo reale
            </span>

            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                aria-label="Giorno precedente"
                onClick={() => setDay((d) => addDays(d, -1))}
                className="grid h-6 w-6 place-items-center rounded-md border border-line bg-surface text-xs text-ink-2"
              >
                ‹
              </button>
              <span className="tabular-nums text-[12.5px] font-medium">
                {isToday(day) ? 'Oggi · ' : ''}
                {format(day, 'EEEE d MMMM', { locale: it })}
              </span>
              <button
                type="button"
                aria-label="Giorno successivo"
                onClick={() => setDay((d) => addDays(d, 1))}
                className="grid h-6 w-6 place-items-center rounded-md border border-line bg-surface text-xs text-ink-2"
              >
                ›
              </button>
              {/* Sempre presente, anche quando è già oggi: se comparisse solo
                  spostandosi, la barra cambierebbe larghezza a ogni freccia e
                  il gestore dovrebbe cercare ogni volta dove è finito. Da
                  spento dice comunque dove si trova. */}
              <button
                type="button"
                disabled={isToday(day)}
                aria-label="Torna a oggi"
                onClick={() => setDay(new Date())}
                className="ml-1 h-6 rounded-md border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink-2 hover:border-pitch hover:text-pitch disabled:border-line-soft disabled:bg-surface-2 disabled:text-muted disabled:hover:border-line-soft disabled:hover:text-muted"
              >
                Oggi
              </button>
            </div>
          </div>

          <DayGrid
            day={day}
            onSlotClick={(fieldId, startMin) => {
              const field = fields.find((f) => f.id === fieldId)
              if (field) setTarget({ field, day, startMin })
            }}
            onBookingClick={setSelected}
          />
        </div>
      </div>

      <NewBookingDialog target={target} onClose={() => setTarget(null)} />
      <BookingDetailDialog
        booking={selected}
        fieldName={fields.find((f) => f.id === selected?.field_id)?.name}
        onClose={() => setSelected(null)}
      />
    </div>
  )
}

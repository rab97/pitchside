import { useState } from 'react'
import { addDays, format, isToday } from 'date-fns'
import { it } from 'date-fns/locale'
import { useFacility } from '../tenant/FacilityProvider'
import { DayGrid } from './DayGrid'
import type { BookingRow } from './DayGrid.hooks'

export function AdminPage() {
  const facility = useFacility()
  const [day, setDay] = useState<Date>(() => new Date())
  const [, setSelected] = useState<BookingRow | null>(null)

  return (
    <div className="min-h-screen bg-ground p-4 sm:p-6">
      <div className="mx-auto max-w-[1140px]">
        <p className="font-mono text-[11px] uppercase tracking-[.14em] text-pitch">
          {facility.name}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-.02em]">
          Giornata
        </h1>

        <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-surface-2 px-3.5 py-3">
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-muted">
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
              <span className="font-mono text-[12.5px] font-medium">
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
              {!isToday(day) && (
                <button
                  type="button"
                  onClick={() => setDay(new Date())}
                  className="rounded-[7px] px-2 py-1 text-[12.5px] text-pitch"
                >
                  Oggi
                </button>
              )}
            </div>
          </div>

          <DayGrid
            day={day}
            onSlotClick={() => {}}
            onBookingClick={setSelected}
          />
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { addDays, format, isToday } from 'date-fns'
import { it } from 'date-fns/locale'
import { Link } from 'react-router-dom'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useFields } from '@/shared/hooks/useFields'
import { DateJump } from '@/shared/components/ui/DateJump'
import { DayGrid } from './DayGrid'
import type { BookingRow } from '../hooks/useDayBookings'
import { BookingDetailDialog } from './BookingDetailDialog'
import { NewBookingDialog, type NewBookingTarget } from './NewBookingDialog'

export function AdminPage() {
  const facility = useFacility()
  const [day, setDay] = useState<Date>(() => new Date())
  const [selected, setSelected] = useState<BookingRow | null>(null)
  const [target, setTarget] = useState<NewBookingTarget | null>(null)
  const { fields } = useFields()

  return (
    <div className="min-h-screen bg-ground p-4 sm:p-6">
      <div className="mx-auto max-w-[1140px]">
        <p className="text-[11px] uppercase tracking-[.14em] text-pitch">
          {facility.name}
        </p>
        <h1 className="mt-1.5 text-2xl font-semibold tracking-[-.02em]">
          Giornata
        </h1>

        <div className="mt-4 overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="flex flex-wrap items-center gap-2 border-b border-line-soft bg-surface-2 px-3.5 py-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-pitch" />
              in tempo reale
            </span>

            {/* Every control in this row grows to 44×44 where the device's
                *primary* pointer is coarse — the floor the spec sets (§2.4,
                "touch targets no smaller than the tab bar's"), already met
                by the calendar's day cells (`MonthGridPopover`) and the
                pitch list's drag handle.

                The gate is `pointer-coarse:` rather than an `sm:`/`lg:`
                breakpoint because window width answers nothing here: a
                tablet on a desk with a trackpad is wide and precise, a
                phone held sideways is wide and is still a thumb.

                But `pointer:` does not answer "could a finger be used"
                either — it reports only the primary pointing device. The
                machine this serves worse is the touchscreen laptop or
                convertible used with its trackpad: it reports
                `pointer: fine`, so a manager who reaches up and taps the
                screen gets the 24px arrows. `any-pointer-coarse:` is the
                query that would catch it (and it does compile in Tailwind
                4.3.3), and it is deliberately not used: it matches on the
                mere presence of a touchscreen, so that same laptop, driven
                all day by its trackpad, would carry a toolbar grown for a
                thumb it mostly does not use. Between an occasionally
                awkward tap and a permanently coarser dense toolbar, the
                trade taken is the first. A toolbar driven by a mouse is
                not broken and does not need the extra 20px. */}
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                aria-label="Giorno precedente"
                onClick={() => setDay((d) => addDays(d, -1))}
                className="grid h-6 w-6 place-items-center rounded-md border border-line bg-surface text-xs text-ink-2 transition-colors hover:border-pitch hover:text-pitch pointer-coarse:h-11 pointer-coarse:w-11"
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
                className="grid h-6 w-6 place-items-center rounded-md border border-line bg-surface text-xs text-ink-2 transition-colors hover:border-pitch hover:text-pitch pointer-coarse:h-11 pointer-coarse:w-11"
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
                // `min-w-11` rather than `w-11`: the label already makes this
                // wider than the floor, and a fixed width would cut it off.
                className="ml-1 h-6 rounded-md border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-pitch hover:text-pitch pointer-coarse:h-11 pointer-coarse:min-w-11"
              >
                Oggi
              </button>
              {/* Nessun min/max: il gestore deve poter guardare indietro —
                  cosa è successo sabato scorso — e prenotare oltre
                  l'orizzonte, che vale solo per `source = 'app'` (vedi
                  `supabase/migrations/0013_member_facility_check.sql`,
                  PS007). Dargli gli stessi limiti del cliente su `/prenota`
                  gli toglierebbe entrambe le cose. */}
              <DateJump onSelect={setDay} label="Vai a una data" />
              <Link
                to="/admin/struttura"
                className="ml-1 inline-flex h-6 items-center justify-center rounded-md border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-pitch hover:text-pitch pointer-coarse:h-11 pointer-coarse:min-w-11"
              >
                Impostazioni
              </Link>
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

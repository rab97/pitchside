import { minToLabel, minutesOfDay } from '../lib/tz'
import type { BookingRow } from './DayGrid.hooks'

// Gli stessi quattro toni della legenda del mockup: chi guarda la griglia
// capisce l'origine di una prenotazione dal colore, senza leggere.
const TONE: Record<string, string> = {
  phone: 'bg-terra-tint border-terra text-terra',
  admin: 'bg-terra-tint border-terra text-terra',
  app: 'bg-pitch-tint border-pitch text-pitch',
  recurrence: 'bg-slate-tint border-slate text-slate',
  tournament: 'bg-ochre-tint border-ochre text-ochre',
}

export function BookingCell({ booking, column, rowStart, rowEnd, onClick }: {
  booking: BookingRow
  column: number
  rowStart: number
  rowEnd: number
  onClick?: (booking: BookingRow) => void
}) {
  const tone = TONE[booking.source] ?? TONE.app
  const from = minToLabel(minutesOfDay(booking.slot_start))
  const to = minToLabel(minutesOfDay(booking.slot_end))

  return (
    <button
      type="button"
      onClick={() => onClick?.(booking)}
      style={{ gridColumn: column, gridRow: `${rowStart} / ${rowEnd}` }}
      className={`z-10 mt-[2px] mb-[2px] ml-[1px] mr-[3px] flex flex-col justify-center gap-px overflow-hidden rounded-md border-l-[3px] px-[7px] py-1 text-left ${tone}`}
    >
      <div className="truncate text-[11.5px] font-medium leading-[1.25]">
        {booking.member_name}
      </div>
      <div className="truncate tabular-nums text-[9.5px] opacity-[.78]">
        {from}–{to}
        {booking.member_phone ? ` · ${booking.member_phone}` : ''}
      </div>
    </button>
  )
}

import { minToLabel, minutesOfDay } from '@/shared/lib/tz'
import { OPEN_MIN, CLOSE_MIN, STEP } from '@/shared/lib/openingHours'
import { BookingCell } from './BookingCell'
import { useDayBookings, type BookingRow } from '../hooks/useDayBookings'

// minutesOfDay converte nel fuso della struttura: usare getHours() darebbe
// la riga sbagliata su un dispositivo con fuso diverso.
function rowFor(d: Date, step: number): number {
  return Math.round((minutesOfDay(d) - OPEN_MIN) / step) + 1
}

// Uno slot che finisce a mezzanotte ha minutesOfDay 0, non 1440: senza questo
// la prenotazione delle 23:00 verrebbe disegnata dalla riga 1.
function rowForEnd(d: Date, step: number): number {
  const m = minutesOfDay(d)
  return Math.round(((m === 0 ? CLOSE_MIN : m) - OPEN_MIN) / step) + 1
}

export function DayGrid({ day, onSlotClick, onBookingClick }: {
  day: Date
  onSlotClick: (fieldId: string, startMin: number) => void
  onBookingClick?: (booking: BookingRow) => void
}) {
  const { fields, bookings, isPending, isPlaceholderData } = useDayBookings(day)
  if (isPending) return <div className="p-6 text-muted">Caricamento…</div>
  if (fields.length === 0) {
    return <div className="p-6 text-muted">Nessun campo attivo in questa struttura.</div>
  }

  const rows = (CLOSE_MIN - OPEN_MIN) / STEP
  const columns = `52px repeat(${fields.length}, minmax(112px, 1fr))`

  return (
    <div
      className={'overflow-x-auto px-3.5 pb-3.5' + (isPlaceholderData ? ' opacity-60' : '')}
      aria-busy={isPlaceholderData}
    >
      <div className="grid min-w-[480px] pt-3 pb-1.5" style={{ gridTemplateColumns: columns }}>
        <div />
        {fields.map((f) => (
          <div key={f.id} className="border-b border-line pb-2 pl-1.5 text-[11.5px] font-medium text-ink-2">
            {f.name}
            <span className="block text-[10px] tracking-[.04em] text-muted">
              {f.kind === 'calcio7' ? 'a 7' : f.kind === 'calcio11' ? 'a 11' : 'a 5'}
              {f.covered ? ' · coperto' : ' · scoperto'}
            </span>
          </div>
        ))}
      </div>

      <div
        className="relative grid min-w-[480px]"
        style={{ gridTemplateColumns: columns, gridAutoRows: '29px' }}
      >
        {/* colonna degli orari */}
        {Array.from({ length: rows }, (_, r) => {
          const min = OPEN_MIN + r * STEP
          return (
            <div
              key={`t-${r}`}
              className="col-start-1 -translate-y-1.5 pr-2 text-right tabular-nums text-[10.5px] text-muted"
              style={{ gridRow: r + 1 }}
            >
              {min % 60 === 0 ? minToLabel(min) : ''}
            </div>
          )
        })}

        {/* celle di sfondo, cliccabili */}
        {fields.map((f, col) =>
          Array.from({ length: rows }, (_, r) => {
            const min = OPEN_MIN + r * STEP
            return (
              <button
                key={`${f.id}-${r}`}
                type="button"
                onClick={() => onSlotClick(f.id, min)}
                className={
                  'border-r border-line-soft hover:bg-pitch-tint ' +
                  (min % 60 === 0 ? 'border-b border-b-line' : 'border-b border-dashed border-b-line-soft')
                }
                style={{ gridColumn: col + 2, gridRow: r + 1 }}
                aria-label={`${f.name} alle ${minToLabel(min)}`}
              />
            )
          }))}

        {/* prenotazioni sopra */}
        {bookings.map((b) => (
          <BookingCell
            key={b.id}
            booking={b}
            column={fields.findIndex((f) => f.id === b.field_id) + 2}
            rowStart={rowFor(b.slot_start, STEP)}
            rowEnd={rowForEnd(b.slot_end, STEP)}
            onClick={onBookingClick}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-line-soft bg-surface-2 px-3.5 py-3">
        {[
          ['bg-terra-tint border-terra', 'Telefonata'],
          ['bg-pitch-tint border-pitch', 'Dall’app'],
          ['bg-slate-tint border-slate', 'Fisso settimanale'],
          ['bg-ochre-tint border-ochre', 'Torneo'],
        ].map(([tone, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5 text-[11.5px] text-ink-2">
            <span className={`h-3 w-3 rounded-[3px] border-l-[3px] ${tone}`} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

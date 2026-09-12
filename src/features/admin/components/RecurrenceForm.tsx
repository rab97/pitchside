import { format, getISODay } from 'date-fns'
import { it } from 'date-fns/locale'
import { DateField } from '@/shared/components/ui/DateField'
import { countOccurrences } from '../utils/recurrence'

const WEEKDAY = ['', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']

export function RecurrenceForm({ day, enabled, until, onToggle, onUntil }: {
  day: Date
  enabled: boolean
  until: string           // 'yyyy-MM-dd'
  onToggle: (v: boolean) => void
  onUntil: (v: string) => void
}) {
  // Noon, not midnight: same discipline as `DateField` and `monthGrid` —
  // a day held at midnight can slide into the day before once a timezone
  // conversion touches it.
  const untilDate = until ? new Date(`${until}T12:00:00`) : null
  const dates = untilDate ? countOccurrences(day, untilDate) : 0

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2 p-2.5">
      <label className="flex items-start gap-2.5 text-[12.5px] leading-[1.4]">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onToggle(e.target.checked)}
          className="mt-0.5 h-[15px] w-[15px] flex-none accent-pitch"
        />
        <span>
          Ripeti ogni {WEEKDAY[getISODay(day)]}
          <em className="mt-0.5 block tabular-nums text-[11.5px] not-italic text-muted">
            {enabled && untilDate
              ? `fino al ${format(untilDate, 'd MMMM', { locale: it })} · ${dates} ${dates === 1 ? 'data' : 'date'}`
              : 'per i gruppi fissi della stagione'}
          </em>
        </span>
      </label>

      {enabled && (
        <div className="flex flex-col gap-1 text-[11.5px] text-muted">
          <span className="uppercase tracking-[.06em]">Fino al</span>
          <DateField
            value={untilDate}
            onChange={(d) => onUntil(format(d, 'yyyy-MM-dd'))}
            min={day}
            aria-label="Fino al"
          />
        </div>
      )}
    </div>
  )
}

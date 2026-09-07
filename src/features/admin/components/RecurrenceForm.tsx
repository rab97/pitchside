import { format, getISODay } from 'date-fns'
import { it } from 'date-fns/locale'
import { countOccurrences } from '../utils/recurrence'

const WEEKDAY = ['', 'lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']

export function RecurrenceForm({ day, enabled, until, onToggle, onUntil }: {
  day: Date
  enabled: boolean
  until: string           // 'yyyy-MM-dd'
  onToggle: (v: boolean) => void
  onUntil: (v: string) => void
}) {
  const dates = until ? countOccurrences(day, new Date(`${until}T12:00:00`)) : 0

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
            {enabled && until
              ? `fino al ${format(new Date(`${until}T12:00:00`), 'd MMMM', { locale: it })} · ${dates} ${dates === 1 ? 'data' : 'date'}`
              : 'per i gruppi fissi della stagione'}
          </em>
        </span>
      </label>

      {enabled && (
        <label className="flex items-center justify-between gap-2 text-[11.5px] text-muted">
          <span className="uppercase tracking-[.06em]">Fino al</span>
          <input
            type="date"
            value={until}
            min={format(day, 'yyyy-MM-dd')}
            onChange={(e) => onUntil(e.target.value)}
            className="rounded-[7px] border border-line bg-surface px-2 py-1 tabular-nums text-[12.5px] text-ink"
          />
        </label>
      )}
    </div>
  )
}

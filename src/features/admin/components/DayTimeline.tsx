import { it } from 'date-fns/locale'
import { formatEuro } from '@/shared/lib/money'
import { minToLabel } from '@/shared/lib/tz'
import { daySegments, type Band } from '../utils/daySegments'

// The fixed label column to the left of every row and of the hour marks:
// shared so the two stay aligned to the same flex body.
const LABEL_WIDTH = 'w-16 shrink-0'

// A closed segment only prints "chiuso" when there is room for it. The
// 480px floor this pattern guarantees (see `DayGrid.tsx:35-38`) puts about a
// third of a pixel behind every minute of the day, so a gap needs to run a
// couple of hours before the word reliably fits instead of overflowing.
const MIN_MINUTES_FOR_LABEL = 90

/**
 * The hour scale shared by all seven day rows — "sits above the seven rows,
 * once" per the brief, not repeated inside each `DayTimeline`. The five
 * marks are evenly spaced fractions of the day (0, 6, 12, 18, 24h), so a
 * plain `justify-between` lines them up closely enough with the segments
 * below without recomputing the same flex-grow scale twice.
 */
export function TimelineHourMarks() {
  return (
    <div className="flex text-[10px] tabular-nums text-muted">
      <span className={LABEL_WIDTH} aria-hidden />
      <div className="flex flex-1 justify-between">
        {[0, 6, 12, 18, 24].map((h) => (
          <span key={h}>{String(h).padStart(2, '0')}</span>
        ))}
      </div>
    </div>
  )
}

/**
 * One weekday of one pitch, drawn to scale from midnight to midnight.
 * Renders exactly what `daySegments` returns — open bands as clickable,
 * priced blocks and closed stretches as inert ones — and adds nothing of
 * its own: the gaps are already computed, this only paints them so a gap
 * reads as "chiuso" instead of empty space.
 */
export function DayTimeline({ bands, weekday, onBandClick }: {
  bands: Band[]
  weekday: number
  onBandClick: (band: Band) => void
}) {
  const segments = daySegments(bands, weekday)
  // `date-fns` day index is 0 (Sunday) … 6 (Saturday); `weekday` here is
  // isodow, 1 (Monday) … 7 (Sunday) — `% 7` maps one onto the other.
  const dayName = it.localize?.day((weekday % 7) as 0 | 1 | 2 | 3 | 4 | 5 | 6, { width: 'wide' }) ?? ''

  return (
    <div className="flex items-stretch gap-0">
      <span className={`${LABEL_WIDTH} self-center pr-2 text-[12px] text-ink-2`}>{dayName}</span>
      <div className="flex h-9 flex-1 overflow-hidden rounded-lg border border-line-soft">
        {segments.map((seg) => {
          const width = seg.toMin - seg.fromMin
          const title = `${minToLabel(seg.fromMin)}–${minToLabel(seg.toMin)}`

          if (seg.kind === 'open') {
            return (
              <button
                key={seg.bandId}
                type="button"
                title={title}
                style={{ flexGrow: width, flexBasis: 0 }}
                onClick={() => {
                  const band = bands.find((b) => b.id === seg.bandId)
                  if (band) onBandClick(band)
                }}
                className="flex items-center justify-center overflow-hidden border border-pitch bg-pitch-tint px-1 text-[11px] font-medium text-pitch transition-colors hover:bg-pitch/20"
              >
                <span className="truncate">{formatEuro(seg.priceCents)}</span>
              </button>
            )
          }

          return (
            <div
              key={`${seg.fromMin}-${seg.toMin}`}
              title={title}
              style={{ flexGrow: width, flexBasis: 0 }}
              className="flex items-center justify-center bg-surface-2 text-[11px] text-muted"
            >
              {width >= MIN_MINUTES_FOR_LABEL ? 'chiuso' : ''}
            </div>
          )
        })}
      </div>
    </div>
  )
}

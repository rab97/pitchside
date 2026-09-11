import { useEffect, useState } from 'react'
import { FieldPicker } from '@/shared/components/ui/FieldPicker'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { useAdminFields } from '../hooks/useAdminFields'
import { usePriceBands } from '../hooks/usePriceBands'
import { DayTimeline, TimelineHourMarks } from './DayTimeline'
import { BandDialog, type BandFormTarget } from './BandDialog'
import type { Band } from '../utils/daySegments'
import { SettingsPage } from './SettingsPage'

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7]

/**
 * The centrepiece of facility configuration: a pitch's whole week as seven
 * timelines. Price bands *are* the opening hours here — a minute no band
 * covers is a minute `calc_booking_price` refuses with PS005 — so this
 * screen has no separate "opening hours" setting anywhere, and a gap in the
 * week is drawn closed rather than left blank.
 */
export function PriceBandsPage() {
  const { fields, isPending: fieldsPending, error: fieldsError } = useAdminFields()
  const [fieldId, setFieldId] = useState<string | null>(null)
  const [target, setTarget] = useState<BandFormTarget | null>(null)

  useEffect(() => {
    if (!fieldId && fields.length > 0) setFieldId(fields[0].id)
  }, [fields, fieldId])

  const { bands, isPending: bandsPending, error: bandsError, saveBand, deleteBand } = usePriceBands(fieldId)

  function openBand(band: Band) {
    setTarget({ mode: 'edit', band })
  }

  return (
    <SettingsPage title="Tariffe">
      <ErrorNote message={fieldsError ? 'Non siamo riusciti a caricare i campi. Riprova.' : null} />

      {fieldsPending ? (
        <p className="text-[13px] text-muted">Carico…</p>
      ) : fields.length === 0 ? (
        <p className="text-[13px] text-muted">
          Nessun campo. Aggiungine uno nella scheda Campi prima di impostare le tariffe.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <FieldPicker fields={fields} selected={fieldId} onSelect={setFieldId} />
            <button
              type="button"
              onClick={() => setTarget({ mode: 'create' })}
              className="rounded-[7px] bg-pitch px-3 py-1.5 text-[12.5px] font-medium text-on-pitch transition-colors hover:bg-pitch-strong"
            >
              Aggiungi fascia
            </button>
          </div>

          <ErrorNote message={bandsError ? 'Non siamo riusciti a caricare le tariffe. Riprova.' : null} />

          {bandsPending ? (
            <p className="text-[13px] text-muted">Carico…</p>
          ) : (
            <div className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
              {bands.length === 0 && (
                <p className="text-[13px] text-muted">
                  Questo campo non ha tariffe: è chiuso tutti i giorni. Aggiungi una fascia per aprirlo.
                </p>
              )}
              <div className="overflow-x-auto">
                <div className="flex min-w-[480px] flex-col gap-1.5">
                  <TimelineHourMarks />
                  {WEEKDAYS.map((w) => (
                    <DayTimeline key={w} bands={bands} weekday={w} onBandClick={openBand} />
                  ))}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <BandDialog
        target={target}
        onClose={() => setTarget(null)}
        bands={bands}
        saveBand={saveBand}
        deleteBand={deleteBand}
      />
    </SettingsPage>
  )
}

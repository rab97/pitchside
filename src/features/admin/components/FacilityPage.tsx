import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { Select } from '@/shared/components/ui/Select'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useUpdateFacility } from '../hooks/useUpdateFacility'
import { SettingsPage } from './SettingsPage'

// The check constraint on `facilities.slot_minutes` allows no other values.
const SLOT_OPTIONS = [15, 30, 60]
// `Select` takes strings; the numbers above are converted at this edge only.
const SLOT_SELECT_OPTIONS = SLOT_OPTIONS.map((m) => ({ value: String(m), label: String(m) }))

/**
 * The club's own identity, plus the rules the booking engine applies across
 * every field: how far ahead a customer can book, how long before a slot
 * they can still cancel for free, and the grid the day view snaps to. One
 * form, one save button — nothing here has a use saved on its own.
 */
export function FacilityPage() {
  const facility = useFacility()
  const { save, isPending, error } = useUpdateFacility()

  const [name, setName] = useState(facility.name)
  const [color, setColor] = useState(facility.color)
  const [phone, setPhone] = useState(facility.phone ?? '')
  const [address, setAddress] = useState(facility.address ?? '')
  const [cancelHours, setCancelHours] = useState(facility.cancel_hours)
  const [horizonDays, setHorizonDays] = useState(facility.booking_horizon_days)
  const [slotMinutes, setSlotMinutes] = useState(facility.slot_minutes)
  const [minDuration, setMinDuration] = useState(facility.min_duration_minutes)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    try {
      await save({
        name: name.trim(),
        color,
        phone: phone.trim() || null,
        address: address.trim() || null,
        cancel_hours: cancelHours,
        booking_horizon_days: horizonDays,
        slot_minutes: slotMinutes,
        min_duration_minutes: minDuration,
      })
      toast.success('Impostazioni salvate.')
    } catch {
      // The hook's `error` drives the ErrorNote below; nothing else to do here.
    }
  }

  return (
    <SettingsPage title="Struttura">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <h2 className="text-[13px] font-semibold text-ink">Identità</h2>
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[.06em] text-muted">Nome</span>
              <input
                className="field"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[.06em] text-muted">Colore</span>
              <input
                type="color"
                className="h-9 w-16 rounded-[7px] border border-line bg-surface-2 p-1"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[.06em] text-muted">Telefono</span>
              <input
                className="field"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                inputMode="tel"
                placeholder="facoltativo"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[.06em] text-muted">Indirizzo</span>
              <input
                className="field"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="facoltativo"
              />
            </label>
          </div>
        </div>

        <div className="rounded-card border border-line bg-surface p-4 shadow-card">
          <h2 className="text-[13px] font-semibold text-ink">Regole di prenotazione</h2>
          <div className="mt-3 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[.06em] text-muted">
                Disdetta gratuita entro (ore)
              </span>
              <input
                type="number"
                min={0}
                className="field"
                value={cancelHours}
                onChange={(e) => setCancelHours(Number(e.target.value))}
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[.06em] text-muted">
                Orizzonte di prenotazione (giorni)
              </span>
              <input
                type="number"
                min={1}
                className="field"
                value={horizonDays}
                onChange={(e) => setHorizonDays(Number(e.target.value))}
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[.06em] text-muted">
                Durata della fascia (minuti)
              </span>
              <Select
                value={String(slotMinutes)}
                onChange={(v) => setSlotMinutes(Number(v))}
                options={SLOT_SELECT_OPTIONS}
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[.06em] text-muted">
                Durata minima di una prenotazione (minuti)
              </span>
              <input
                type="number"
                min={1}
                className="field"
                value={minDuration}
                onChange={(e) => setMinDuration(Number(e.target.value))}
                required
              />
            </label>
          </div>
        </div>

        <ErrorNote message={error ? 'Non siamo riusciti a salvare le impostazioni. Riprova.' : null} />

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-[7px] bg-pitch px-4 py-2 text-[13px] font-medium text-on-pitch transition-colors hover:bg-pitch-strong"
          >
            {isPending ? 'Salvo…' : 'Salva'}
          </button>
        </div>
      </form>
    </SettingsPage>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { Dialog } from '@/shared/components/ui/Dialog'
import { formatEuro } from '@/shared/lib/money'
import { supabase } from '@/shared/lib/supabase'
import { dayKey, minToLabel } from '@/shared/lib/tz'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import type { FieldRow } from '@/shared/hooks/useFields'
import { pickExistingMember } from '../utils/pickMember'
import { defaultSeasonEnd } from '../utils/recurrence'
import { RecurrenceForm } from './RecurrenceForm'
import { useCreateBooking } from '../hooks/useCreateBooking'
import { useCreateRecurrence } from '../hooks/useCreateRecurrence'

const DURATIONS = [60, 90, 120]

export type NewBookingTarget = { field: FieldRow; day: Date; startMin: number }

/**
 * Se la telefonata corrisponde a una scheda esistente si riusa quella;
 * altrimenti si crea un member con `user_id` nullo. È il punto in cui si evita
 * metà dei doppioni: senza, ogni telefonata crea una scheda nuova.
 *
 * La ricerca guarda telefono *e* nome perché la prenotazione può fallire dopo
 * che la scheda è stata creata — lo slot occupato nel frattempo — e al secondo
 * tentativo il gestore ridigita lo stesso nome. La regola di scelta sta in
 * pickExistingMember, con i suoi test.
 */
async function resolveMember(facilityId: string, name: string, phone: string) {
  const digits = phone.replace(/\D/g, '')
  const trimmed = name.trim()

  // I valori vanno fra virgolette: un nome con una virgola spezzerebbe la
  // sintassi del filtro `or` di PostgREST.
  const quoted = (v: string) => `"${v.replace(/"/g, '\\"')}"`
  const conditions = [`name.ilike.${quoted(trimmed)}`]
  if (digits) conditions.unshift(`phone.eq.${quoted(digits)}`)

  const { data: candidates } = await supabase.from('members')
    .select('id, name, phone')
    .eq('facility_id', facilityId)
    .or(conditions.join(','))

  const existing = pickExistingMember(candidates ?? [], trimmed, digits)
  if (existing) return existing

  const { data, error } = await supabase.from('members')
    .insert({ facility_id: facilityId, name: trimmed, phone: digits || null })
    .select('id').single()
  if (error) throw error
  return data.id
}

export function NewBookingDialog({ target, onClose }: {
  target: NewBookingTarget | null
  onClose: () => void
}) {
  const facility = useFacility()
  const create = useCreateBooking()
  const createRecurrence = useCreateRecurrence()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [minutes, setMinutes] = useState(facility.min_duration_minutes || 60)
  const [repeat, setRepeat] = useState(false)
  const [until, setUntil] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // La schermata si usa col telefono all'orecchio: si apre col fuoco sul nome
  // e si conferma con Invio. Tutto il resto è facoltativo.
  useEffect(() => {
    if (target) {
      setName(''); setPhone(''); setError(null)
      setMinutes(facility.min_duration_minutes || 60)
      setRepeat(false)
      setUntil(format(defaultSeasonEnd(target.day), 'yyyy-MM-dd'))
      requestAnimationFrame(() => nameRef.current?.focus())
    }
  }, [target, facility.min_duration_minutes])

  const suggestions = useMemberSuggestions(facility.id, name)

  const context = useMemo(() => {
    if (!target) return ''
    return `${target.field.name.toUpperCase()} · ${format(target.day, 'EEE d MMM', { locale: it }).toUpperCase()} · ${minToLabel(target.startMin)}`
  }, [target])

  async function submit() {
    if (!target || !name.trim()) return
    setError(null)
    try {
      const memberId = await resolveMember(facility.id, name, phone)

      if (repeat && until) {
        const { created, skipped, skipped_dates } = await createRecurrence.mutateAsync({
          facilityId: facility.id,
          fieldId: target.field.id,
          memberId,
          day: target.day,
          startMin: target.startMin,
          minutes,
          until,
        })
        if (created === 0) {
          setError('Nessuna data creata: il campo è già occupato in tutte quelle scelte.')
          return
        }
        toast.success(
          skipped === 0
            ? `Create ${created} date.`
            : `Create ${created} date. ${skipped} saltate perché il campo era già occupato: ` +
              skipped_dates
                .map((d) => format(new Date(`${d}T12:00:00`), 'd MMM', { locale: it }))
                .join(', '),
          { duration: skipped === 0 ? 4000 : 12000 },
        )
        onClose()
        return
      }

      const booking = await create.mutateAsync({
        fieldId: target.field.id,
        day: dayKey(target.day),
        startMin: target.startMin,
        minutes,
        memberId,
        source: 'phone',
      })
      const price = (booking as { price_cents: number } | null)?.price_cents
      toast.success(
        `Prenotato: ${name.trim()}, ${minToLabel(target.startMin)}–${minToLabel(target.startMin + minutes)}` +
        (price != null ? ` · ${formatEuro(price)}` : ''),
      )
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'La prenotazione non è riuscita. Riprova.')
    }
  }

  return (
    <Dialog open={!!target} onClose={onClose} labelledBy="nb-title">
      <form
        className="flex flex-col gap-3 p-4"
        onSubmit={(e) => { e.preventDefault(); submit() }}
      >
        <p className="tabular-nums text-[11px] tracking-[.03em] text-muted">{context}</p>
        <h3 id="nb-title" className="text-base font-semibold tracking-[-.01em]">
          Nuova prenotazione
        </h3>

        <label className="flex flex-col gap-1.5">
          <span className="tabular-nums text-[11px] uppercase tracking-[.06em] text-muted">Nome</span>
          <input
            ref={nameRef}
            className="rounded-[7px] border border-line bg-surface-2 px-2.5 py-2 text-[13.5px] text-ink outline-none focus:border-pitch"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="off"
            required
          />
        </label>

        {suggestions.length > 0 && (
          <ul className="-mt-1 flex flex-col overflow-hidden rounded-[7px] border border-line-soft">
            {suggestions.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left text-[12.5px] hover:bg-surface-2"
                  onClick={() => { setName(m.name); setPhone(m.phone ?? '') }}
                >
                  {m.name}
                  <span className="tabular-nums text-[11px] text-muted">{m.phone ?? ''}</span>
                </button>
              </li>
            ))}
          </ul>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="tabular-nums text-[11px] uppercase tracking-[.06em] text-muted">Telefono</span>
          <input
            className="rounded-[7px] border border-line bg-surface-2 px-2.5 py-2 text-[13.5px] text-ink outline-none placeholder:text-muted focus:border-pitch"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="facoltativo"
            inputMode="tel"
            autoComplete="off"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="tabular-nums text-[11px] uppercase tracking-[.06em] text-muted">Durata</span>
          <div className="flex gap-1.5">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={minutes === d}
                onClick={() => setMinutes(d)}
                className={
                  'flex-1 rounded-[7px] border py-1.5 text-center tabular-nums text-xs ' +
                  (minutes === d
                    ? 'border-pitch bg-pitch text-surface'
                    : 'border-line bg-surface-2 text-ink-2')
                }
              >
                {d === 60 ? '1h' : d === 90 ? '1h 30' : '2h'}
              </button>
            ))}
          </div>
        </div>

        <RecurrenceForm
          day={target?.day ?? new Date()}
          enabled={repeat}
          until={until}
          onToggle={setRepeat}
          onUntil={setUntil}
        />

        {error && (
          <p role="alert" className="rounded-lg border border-terra bg-terra-tint px-3 py-2 text-[12.5px] text-terra">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-0.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[7px] border border-line px-3 py-1.5 text-[12.5px] text-ink-2"
          >
            Annulla
          </button>
          <button
            type="submit"
            disabled={create.isPending || createRecurrence.isPending || !name.trim()}
            className="rounded-[7px] bg-pitch px-3 py-1.5 text-[12.5px] font-medium text-white disabled:opacity-50"
          >
            {create.isPending || createRecurrence.isPending ? 'Salvo…' : 'Conferma'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

function useMemberSuggestions(facilityId: string, term: string) {
  const q = term.trim()
  const { data } = useQuery({
    queryKey: ['member-search', facilityId, q],
    enabled: q.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, name, phone')
        .eq('facility_id', facilityId)
        .ilike('name', `%${q}%`)
        .limit(5)
      if (error) throw error
      return data
    },
  })
  // Un solo risultato identico a quanto digitato non è un suggerimento utile.
  if (!data || (data.length === 1 && data[0].name === q)) return []
  return data
}

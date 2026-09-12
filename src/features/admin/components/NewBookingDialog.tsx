import { useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { toast } from 'sonner'
import { Dialog } from '@/shared/components/ui/Dialog'
import { formatEuro } from '@/shared/lib/money'
import { dayKey, minToLabel } from '@/shared/lib/tz'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import type { FieldRow } from '@/shared/hooks/useFields'
import { digitsOf } from '../utils/memberKeys'
import { isPhoneTaken, memberMessage } from '../utils/memberMessages'
import { defaultSeasonEnd } from '../utils/recurrence'
import { MemberCard } from './MemberCard'
import { MemberSearchField, type MemberChoice } from './MemberSearchField'
import { RecurrenceForm } from './RecurrenceForm'
import { useCreateBooking } from '../hooks/useCreateBooking'
import { useCreateMember } from '../hooks/useCreateMember'
import { useCreateRecurrence } from '../hooks/useCreateRecurrence'
import { useMemberCard } from '../hooks/useMemberCard'
import { useUpdateMemberNotes } from '../hooks/useUpdateMemberNotes'

const DURATIONS = [60, 90, 120]

export type NewBookingTarget = { field: FieldRow; day: Date; startMin: number }

export function NewBookingDialog({ target, onClose }: {
  target: NewBookingTarget | null
  onClose: () => void
}) {
  const facility = useFacility()
  const create = useCreateBooking()
  const createRecurrence = useCreateRecurrence()
  const { createMember, creating } = useCreateMember()
  const [choice, setChoice] = useState<MemberChoice>({ kind: 'none' })
  const { card } = useMemberCard(choice.kind === 'existing' ? choice.member.id : null)
  const { saveNotes, saveError } = useUpdateMemberNotes()
  const [phone, setPhone] = useState('')
  const [minutes, setMinutes] = useState(facility.min_duration_minutes || 60)
  const [repeat, setRepeat] = useState(false)
  const [until, setUntil] = useState('')
  const [error, setError] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)

  // This screen is used with the phone against an ear: it opens with the focus
  // on the customer field and is confirmed with Enter. Everything else is
  // optional.
  useEffect(() => {
    if (target) {
      setChoice({ kind: 'none' }); setPhone(''); setError(null)
      setMinutes(facility.min_duration_minutes || 60)
      setRepeat(false)
      setUntil(format(defaultSeasonEnd(target.day), 'yyyy-MM-dd'))
      requestAnimationFrame(() => nameRef.current?.focus())
    }
  }, [target, facility.min_duration_minutes])

  const context = useMemo(() => {
    if (!target) return ''
    return `${target.field.name.toUpperCase()} · ${format(target.day, 'EEE d MMM', { locale: it }).toUpperCase()} · ${minToLabel(target.startMin)}`
  }, [target])

  // Never takes `{ kind: 'none' }`: nothing chosen is not a member to resolve,
  // it is a sentence to show, and `submit` returns before ever getting here.
  async function memberIdFor(c: Exclude<MemberChoice, { kind: 'none' }>): Promise<string> {
    if (c.kind === 'existing') return c.member.id
    // `kind: 'new'` is the only place a customer is born, and it is reached
    // only by an explicit click. Before this, `resolveMember` inserted on its
    // own every time it failed to recognize a name.
    const id = await createMember({ name: c.name, phone })
    // The booking can still fail after the row exists — the slot taken in the
    // meantime — and the manager presses «Conferma» again. The customer is
    // real now, so the choice becomes a chosen one: a second attempt books for
    // them instead of inserting them twice, which the unique index on the
    // phone would reject and report as a collision with the row just written.
    // That retry is the case `resolveMember` searched by name to cover.
    setChoice({
      kind: 'existing',
      member: { id, name: c.name, phone: digitsOf(phone) || null, hasMissed: false },
    })
    return id
  }

  async function submit() {
    if (!target) return
    if (choice.kind === 'none') {
      setError('Scegli un cliente dall’elenco, oppure creane uno nuovo.')
      return
    }
    setError(null)
    // The name in the toast comes from the choice, never from a text field:
    // the whole point of this screen is that the two can no longer disagree.
    const bookedName = choice.kind === 'existing' ? choice.member.name : choice.name
    try {
      const memberId = await memberIdFor(choice)

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
        `Prenotato: ${bookedName}, ${minToLabel(target.startMin)}–${minToLabel(target.startMin + minutes)}` +
        (price != null ? ` · ${formatEuro(price)}` : ''),
      )
      onClose()
    } catch (e) {
      setError(isPhoneTaken(e) ? memberMessage(e, 'create')
        : e instanceof Error ? e.message
        : 'La prenotazione non è riuscita. Riprova.')
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

        <MemberSearchField choice={choice} onChoose={setChoice} inputRef={nameRef} />

        {choice.kind === 'existing' && card && (
          <MemberCard
            card={card}
            saveError={saveError}
            onNotesBlur={(notes) => { void saveNotes(card.id, notes) }}
          />
        )}

        {/* Only while a customer is being created. `createMember`'s insert is
            the one and only write of a phone in this dialog, and it is not
            getting a second: adding a number to someone who already exists
            belongs to the registry, not to a screen answered with the phone in
            hand. Left rendered for a chosen customer the field would be typeable
            and unwritable at once — worst right after a retry, where the manager
            has just been told this person will be unrecognisable without a
            number, would type it, and would watch it be dropped. `MemberCard`
            shows the number the record actually holds. */}
        {choice.kind === 'new' && (
          <>
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] uppercase tracking-[.06em] text-muted">Telefono</span>
              <input
                className="field placeholder:text-muted"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="facoltativo"
                inputMode="tel"
                autoComplete="off"
              />
            </label>

            {phone.trim() === '' && (
              <p className="text-[11.5px] text-muted">
                Senza numero questo cliente non sarà riconoscibile la prossima volta.
              </p>
            )}
          </>
        )}

        <div className="flex flex-col gap-1.5">
          <span className="text-[11px] uppercase tracking-[.06em] text-muted">Durata</span>
          <div className="flex gap-1.5">
            {DURATIONS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={minutes === d}
                onClick={() => setMinutes(d)}
                className={
                  'flex-1 rounded-[7px] border py-1.5 text-center text-xs transition-colors ' +
                  (minutes === d
                    ? 'border-pitch bg-pitch text-surface'
                    : 'border-line bg-surface-2 text-ink-2 hover:border-pitch')
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
            className="rounded-[7px] border border-line px-3 py-1.5 text-[12.5px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
          >
            Annulla
          </button>
          {/* Deliberately not disabled on the choice: a button that refuses
              without saying why is worse than one that names what is missing,
              which is what `submit` does when nothing has been chosen. */}
          <button
            type="submit"
            disabled={create.isPending || createRecurrence.isPending || creating}
            className="rounded-[7px] bg-pitch px-3 py-1.5 text-[12.5px] font-medium text-on-pitch transition-colors hover:bg-pitch-strong"
          >
            {create.isPending || createRecurrence.isPending ? 'Salvo…' : 'Conferma'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

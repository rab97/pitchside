import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import type { MemberCardData } from '../hooks/useMemberCard'

/**
 * What the manager reads while someone is talking to them on the phone.
 *
 * No percentage, by choice: nothing in this project increments
 * `honored_count`, so `member_reliability` would only ever read `null` or
 * `0%` — a regular with fifty appearances and one no-show would read zero.
 * Appearances here are counted from past bookings and stated in words
 * instead: a percentage invites comparing people against each other and
 * hides how many cases it was computed over.
 */
function reliabilitySentence(appearances: number, missed: number): string {
  if (appearances === 0 && missed === 0) return 'Cliente nuovo'
  const shown = `Si è presentato ${appearances} ${appearances === 1 ? 'volta' : 'volte'}`
  if (missed === 0) return shown
  return `${shown}, ${missed} ${missed === 1 ? 'mancata' : 'mancate'}`
}

export function MemberCard({ card, onNotesBlur, saveError }: {
  card: MemberCardData
  onNotesBlur: (notes: string) => void
  saveError: string | null
}) {
  const [draft, setDraft] = useState(card.notes ?? '')

  // These are the manager's private notes about a named person: a switch to
  // a different member must never leave the previous member's unsent draft
  // sitting under the new name. This mirrors the reset idiom already used
  // for other per-selection state on this branch (see `BookingDetailDialog`
  // and `BookingPage`, both keyed on the identity they reset for).
  useEffect(() => { setDraft(card.notes ?? '') }, [card.id])

  const history: string[] = []
  if (card.lastPlayed) {
    history.push(`Ultima volta ${format(card.lastPlayed, 'd MMM yyyy', { locale: it })}`)
  }
  if (card.usualFieldName) history.push(`Di solito ${card.usualFieldName}`)

  return (
    <div className="flex flex-col gap-2 rounded-[7px] border border-line-soft bg-surface-2 p-2.5">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-[13px] font-medium">{card.name}</span>
        {card.phone && (
          <span className="tabular-nums text-[12px] text-muted">{card.phone}</span>
        )}
        {card.priceList !== 'standard' && (
          <span className="rounded-md bg-pitch-tint px-1.5 py-0.5 text-[11px] text-pitch">
            Listino {card.priceList}
          </span>
        )}
      </div>

      <p className="text-[12px] text-ink-2">{reliabilitySentence(card.appearances, card.missed)}</p>
      {history.length > 0 && (
        <p className="text-[11.5px] text-muted">{history.join(' · ')}</p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-[11px] uppercase tracking-[.06em] text-muted">Note interne</span>
        <textarea
          // `.field` owns border/radius/background/padding-inline; height is
          // overridden here on purpose — its fixed 2.25rem single-line box
          // does not fit a notes field that needs to grow, and there is no
          // sibling `.field` on this card for it to line up with.
          className="field h-auto min-h-16 resize-y py-1.5 text-[12.5px]"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          // Saves on leaving the field, not on a button: notes get typed in
          // a hurry on the phone, and a note lost because nobody clicked is
          // worse than one written halfway. The comparison avoids resaving
          // something that never changed.
          onBlur={() => { if (draft !== (card.notes ?? '')) onNotesBlur(draft) }}
        />
      </label>

      {saveError && <ErrorNote message={saveError} />}
    </div>
  )
}

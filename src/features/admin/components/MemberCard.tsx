import { useState } from 'react'
import { format } from 'date-fns'
import { it } from 'date-fns/locale'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import type { MemberCardData } from '../hooks/useMemberCard'

/**
 * Quello che il gestore legge mentre parla.
 *
 * Niente percentuali, per scelta: `honored_count` non lo incrementa nessuno,
 * quindi `member_reliability` varrebbe `null` oppure `0%` e basta — un cliente
 * con cinquanta presenze e una assenza leggerebbe zero. Qui le presenze si
 * contano dalle prenotazioni passate e si dicono a parole: una percentuale
 * invita a confrontare le persone e nasconde su quanti casi è calcolata.
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
          // Si salva uscendo dal campo: al telefono si scrive di fretta, e una
          // nota persa perché nessuno ha cliccato è peggio di una scritta a
          // metà. Il confronto evita di riscrivere ciò che non è cambiato.
          onBlur={() => { if (draft !== (card.notes ?? '')) onNotesBlur(draft) }}
        />
      </label>

      {saveError && <ErrorNote message={saveError} />}
    </div>
  )
}

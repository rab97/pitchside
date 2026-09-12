import { useState } from 'react'
import { useMemberSearch, type MemberHit } from '../hooks/useMemberSearch'

export type MemberChoice =
  | { kind: 'none' }
  | { kind: 'existing'; member: MemberHit }
  | { kind: 'new'; name: string }

/**
 * The field that recognizes who is calling.
 *
 * Before this, picking a suggestion only filled two text inputs, and
 * `resolveMember` re-guessed the member at save time: a manager could choose
 * one person and book for another. Here the choice is a value —
 * `MemberChoice` — and the parent carries it all the way to the booking.
 */
export function MemberSearchField({ choice, onChoose, inputRef }: {
  choice: MemberChoice
  onChoose: (c: MemberChoice) => void
  inputRef?: React.RefObject<HTMLInputElement | null>
}) {
  const [term, setTerm] = useState('')
  const { results, failed } = useMemberSearch(term)
  const typed = term.trim()

  if (choice.kind === 'existing') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] font-medium">{choice.member.name}</span>
        <button
          type="button"
          onClick={() => { setTerm(''); onChoose({ kind: 'none' }) }}
          className="rounded-md border border-line px-2 py-1 text-[12px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch pointer-coarse:min-h-11 pointer-coarse:px-3"
        >
          Cambia cliente
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[.06em] text-muted">Cliente</span>
        <input
          ref={inputRef}
          className="field"
          value={term}
          onChange={(e) => {
            setTerm(e.target.value)
            // Typing after a choice was made undoes it — but typing itself,
            // starting from no choice, is not a choice: it must stay silent
            // or the "creating is a deliberate gesture" test above fails.
            if (choice.kind !== 'none') onChoose({ kind: 'none' })
          }}
          autoComplete="off"
        />
      </label>

      {/* The phone is ringing: a broken search is a degradation, never a
          blocker. The customer can still be created and the booking made. */}
      {failed && (
        <p className="text-[11.5px] text-muted">
          Non siamo riusciti a cercare fra i clienti: puoi comunque prenotare.
        </p>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col overflow-hidden rounded-[7px] border border-line-soft">
          {results.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onClick={() => onChoose({ kind: 'existing', member: m })}
                className="flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left text-[12.5px] hover:bg-surface-2 pointer-coarse:min-h-11"
              >
                {m.name}
                <span className="tabular-nums text-[11px] text-muted">{m.phone ?? ''}</span>
                {/* The list is for recognizing, the card for judging: here a
                    mark, not a number. */}
                {m.hasMissed && (
                  <span
                    aria-label="Ha mancato almeno una prenotazione"
                    className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-terra"
                  />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {typed.length > 0 && (
        <button
          type="button"
          onClick={() => onChoose({ kind: 'new', name: typed })}
          className="self-start rounded-md border border-line px-2 py-1 text-[12px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch pointer-coarse:min-h-11 pointer-coarse:px-3"
        >
          Nuovo cliente: {typed}
        </button>
      )}
    </div>
  )
}

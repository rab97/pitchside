import { useState } from 'react'
import { useMemberSearch, type MemberHit } from '../hooks/useMemberSearch'
import { nameKey } from '../utils/memberKeys'

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
  // The name this question has already been answered for, and the one it is
  // being asked about right now. Both hold a `nameKey`, not what was typed:
  // «Nicolò» and «nicolo» are one name here for the same reason they are one
  // name in `search_members`.
  const [settledName, setSettledName] = useState<string | null>(null)
  const [askedName, setAskedName] = useState<string | null>(null)
  const { results, failed } = useMemberSearch(term)
  const typed = term.trim()
  const typedKey = nameKey(typed)

  // §2.7b. The rows are the ones `search_members` already returned, so the
  // question costs no extra query: whoever carries this name is by
  // construction among the hits for it.
  const sameName = typed === '' ? [] : results.filter((m) => nameKey(m.name) === typedKey)
  const asking = askedName === typedKey && sameName.length > 0

  function wantNew() {
    // A warning, not a block. With §2.6's required number two customers
    // sharing a name necessarily hold different numbers, so they are genuinely
    // two people — and the identical pair is refused by the unique index
    // before this question can be asked. The manager must be able to say
    // "different person" and go on; the point is that they say it.
    if (sameName.length > 0 && settledName !== typedKey) {
      setAskedName(typedKey)
      return
    }
    onChoose({ kind: 'new', name: typed })
  }

  if (choice.kind === 'existing') {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[13.5px] font-medium">{choice.member.name}</span>
        <button
          type="button"
          onClick={() => {
            setTerm(''); setAskedName(null); setSettledName(null)
            onChoose({ kind: 'none' })
          }}
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
          onClick={wantNew}
          className="self-start rounded-md border border-line px-2 py-1 text-[12px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch pointer-coarse:min-h-11 pointer-coarse:px-3"
        >
          Nuovo cliente: {typed}
        </button>
      )}

      {/* Deliberately the same shape as the answer for a number already
          assigned: name the conflict, offer the choices, do not throw an
          error. Two near-identical situations must not teach the manager two
          different habits. */}
      {asking && (
        <div className="flex flex-col gap-1.5 rounded-[7px] border border-line bg-surface-2 p-2.5">
          <p className="text-[12.5px] text-ink-2">
            {sameName.length === 1
              ? `C’è già un cliente che si chiama «${sameName[0].name}». È la stessa persona?`
              : `Ci sono già ${sameName.length} clienti che si chiamano «${sameName[0].name}». È una di loro?`}
          </p>
          {sameName.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => { setAskedName(null); onChoose({ kind: 'existing', member: m }) }}
              className="flex w-full items-baseline gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-left text-[12.5px] transition-colors hover:border-pitch hover:text-pitch pointer-coarse:min-h-11"
            >
              Usa la scheda di {m.name}
              <span className="tabular-nums text-[11px] text-muted">{m.phone ?? ''}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              setAskedName(null); setSettledName(typedKey)
              onChoose({ kind: 'new', name: typed })
            }}
            className="self-start rounded-md border border-line px-2 py-1 text-[12px] text-ink-2 transition-colors hover:border-pitch hover:text-pitch pointer-coarse:min-h-11 pointer-coarse:px-3"
          >
            No, è una persona diversa
          </button>
        </div>
      )}
    </div>
  )
}

import { useState, type JSX } from 'react'
import { Link } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import { ErrorNote } from '@/shared/components/ui/ErrorNote'
import { MobileFrame } from '@/shared/components/ui/MobileFrame'
import { LOGIN_ROUTE } from '@/shared/lib/routes'
import { useFacility } from '@/shared/tenant/FacilityProvider'
import { useAuth } from '../hooks/AuthProvider'
import { useLinkGoogle } from '../hooks/useLinkGoogle'
import { useSignOut } from '../hooks/useSignOut'
import { useUpdateEmail } from '../hooks/useUpdateEmail'
import { displayPhone } from '../utils/phoneDisplay'

const cardClass = 'rounded-card border border-line bg-surface p-4 shadow-card'
const sectionTitleClass =
  'text-[13px] font-medium uppercase tracking-[.08em] text-muted'
// A wait, not a failure: ochre, the tone this app keeps for "not yet".
const noticeClass =
  'mt-3 rounded-lg border border-ochre bg-ochre-tint px-3 py-2 text-[12.5px] leading-[1.5] text-ochre'

// Every control here is meant for a thumb: the floor is the tab bar's, reached
// with `pointer-coarse:` for the reason set out over the admin toolbar
// (`AdminPage.tsx`) — window width answers nothing about what is pointing.
// `ProfilePage.test.tsx` measures each of them.
const primaryButtonClass =
  'w-full rounded-lg bg-pitch px-3 py-2.5 text-center text-sm font-medium ' +
  'text-on-pitch transition-colors hover:bg-pitch-strong pointer-coarse:min-h-11'
const quietButtonClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-center ' +
  'text-[13.5px] font-medium text-ink transition-colors hover:border-pitch ' +
  'hover:text-pitch pointer-coarse:min-h-11'

/**
 * The account screen, and the first one this app has ever had for the
 * customer's own account: the ways they sign in, the address we can write to,
 * the Google door they may want to attach, and the way out.
 *
 * The shell is `MyBookingsPage`'s — `MobileFrame` with a title on the phone,
 * the facility header from `lg` up — so this reads as a sibling of that
 * screen rather than a new kind of page. Loading renders inside the frame and
 * not in place of it: the tab bar belongs to the app, not to the state this
 * one screen happens to be in, and a bar that vanishes on every mount of a
 * tab is a bar that moves under the thumb.
 */
export function ProfilePage(): JSX.Element {
  const facility = useFacility()
  const { session, loading } = useAuth()

  return (
    <MobileFrame title="Profilo">
      <header className="hidden border-b border-line bg-surface lg:block">
        <div className="mx-auto flex max-w-[1140px] items-center gap-3 px-4 py-3.5 sm:px-6">
          <Link to="/" className="flex items-center gap-3">
            <div
              className="grid h-8 w-8 place-items-center rounded-full bg-pitch text-sm font-semibold text-on-pitch"
              aria-hidden
            >
              {facility.name.charAt(0)}
            </div>
            <span className="text-[15px] font-semibold tracking-[-.01em]">
              {facility.name}
            </span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[560px] px-4 py-6 sm:px-6">
        <p className="hidden text-[11px] uppercase tracking-[.14em] text-pitch lg:block">
          {facility.name}
        </p>
        {/* As in `MyBookingsPage`: on a phone the visible title is the top
            bar's, and the `<h1>` stays `sr-only`, because a page without a
            heading does not tell whoever is listening what it is about. */}
        <h1 className="sr-only lg:not-sr-only lg:mt-1.5 lg:text-2xl lg:font-semibold lg:tracking-[-.02em]">
          Profilo
        </h1>

        {loading
          ? <p className="mt-6 text-ink-2">Caricamento…</p>
          : session ? <Account user={session.user} /> : <Invitation />}
      </main>
    </MobileFrame>
  )
}

/**
 * The tab is there for everyone, signed in or not (spec §3.1): this says what
 * the screen holds and offers the way in. Not a redirect, not a locked door —
 * it would be the only place in the app that throws you out on tap.
 */
function Invitation() {
  return (
    <div className={`mt-6 flex flex-col gap-3 ${cardClass}`}>
      <h2 className="text-[17px] font-semibold tracking-[-.01em]">
        Il tuo account
      </h2>
      <p className="text-[13.5px] leading-[1.55] text-ink-2">
        Qui trovi il numero con cui entri, l’indirizzo email a cui potremo
        avvisarti delle prenotazioni e il modo per uscire. Entra per vederli.
      </p>
      <Link to={LOGIN_ROUTE} className={primaryButtonClass}>
        Accedi
      </Link>
    </div>
  )
}

function Account({ user }: { user: User }) {
  // `new_email` is the change awaiting confirmation, `email` the address that
  // actually works. They are two fields because they are two different things
  // (spec §3.2), and this screen never conflates them.
  const pending = user.new_email
  const hasGoogle = (user.identities ?? []).some((i) => i.provider === 'google')
  const { signOut, leaving, error } = useSignOut()

  return (
    <div className="mt-6 flex flex-col gap-5">
      <section className={cardClass}>
        <h2 className={sectionTitleClass}>Come entri</h2>
        {/* The list holds the account's working data and nothing else. An
            address awaiting confirmation does not appear here — it lives in
            its own notice further down, and that difference is the whole of
            §3.2.

            Every row is conditional, the phone included. `ensure_my_member`
            creates the card whether or not a phone is confirmed, so a
            customer who only ever signed in with Google is a fully working
            customer with no number — and Google is the route `LoginPage`
            pushes people towards. An unconditional row would print an empty
            value and claim they sign in with something they do not have. */}
        <ul aria-label="Dati dell’account" className="mt-3 flex flex-col gap-2.5">
          {user.phone && (
            <AccountRow label="Telefono" value={displayPhone(user.phone)} numeric />
          )}
          {user.email && <AccountRow label="Email" value={user.email} />}
          {hasGoogle && <AccountRow label="Google" value="Collegato" />}
        </ul>
        {/* True only of an account that has a number: the adoption of a card
            the manager created over the phone keys on exactly that. */}
        {user.phone && (
          <p className="mt-3 text-[12px] leading-[1.5] text-muted">
            Il numero è la tua chiave: è con quello che ritrovi lo storico
            delle prenotazioni fatte al telefono.
          </p>
        )}
      </section>

      <EmailSection active={user.email} pending={pending} />

      {!hasGoogle && <GoogleSection />}

      <section className="flex flex-col gap-2">
        <button
          type="button"
          onClick={signOut}
          disabled={leaving}
          className={quietButtonClass}
        >
          {leaving ? 'Uscita…' : 'Esci'}
        </button>
        <ErrorNote message={error} />
      </section>
    </div>
  )
}

function AccountRow({ label, value, numeric = false }: {
  label: string
  value: string
  numeric?: boolean
}) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className="text-[13px] text-ink-2">{label}</span>
      <span
        className={
          'text-[15px] font-medium ' + (numeric ? 'tabular-nums' : 'break-all')
        }
      >
        {value}
      </span>
    </li>
  )
}

/**
 * Five states, in this order: a change awaiting confirmation over an address
 * that already works, a change awaiting confirmation with nothing behind it, a
 * confirmation just sent, an address that works, no address at all.
 *
 * The first two are one situation with two different truths in it. Supabase is
 * configured with `double_confirm_changes = true`, so a customer who already
 * has a confirmed address gets two messages — one at each address — and the
 * change lands only once both links are opened. Saying "open the link we sent
 * there" to that customer sends them to do half the job and leaves them
 * reading «in attesa di conferma» afterwards with no explanation.
 *
 * The second and third are separate on purpose. `updateUser` records the pending
 * change and sends a link; the session's `new_email` only catches up when
 * `USER_UPDATED` propagates, so the render right after a successful click is
 * normally `sent` with no `pending` yet. Both must say the same thing — the
 * message has gone out, the address is not yet the customer's — because the
 * sentence that would come naturally there is «indirizzo salvato», and an
 * address shown as working that receives nothing is the product claiming
 * something it is not doing (spec §3.2).
 *
 * The field stays in all five: an address typed wrong, or pending on a
 * mailbox nobody opens, would otherwise be uncorrectable from this screen,
 * and `updateUser` is the same gesture either way.
 */
function EmailSection({ active, pending }: {
  active?: string | null
  pending?: string | null
}) {
  const { setEmail, saving, error, sent } = useUpdateEmail()
  const [value, setValue] = useState('')

  return (
    <section className={cardClass}>
      <h2 className={sectionTitleClass}>Dove ti scriviamo</h2>

      {pending && active ? (
        // Two messages, and both links have to be opened: `config.toml` sets
        // `double_confirm_changes = true`, which is the right setting — it is
        // what stops a stolen session from silently moving the account to an
        // address its owner never sees. The cost is that the singular sentence
        // below is false here, and the customer who opens only the one link it
        // named comes back to an unchanged screen with nothing explaining why.
        <p role="status" className={noticeClass}>
          In attesa di conferma: {pending}. Per sicurezza il messaggio è andato
          a tutti e due gli indirizzi, il nuovo e {active}: il cambio vale
          quando hai aperto tutti e due i collegamenti. Fino ad allora
          l’indirizzo resta {active}.
        </p>
      ) : pending ? (
        // `role="status"` rather than `alert`: this is not a failure, it is a
        // wait. It names the address, which the `sent` notice below cannot.
        <p role="status" className={noticeClass}>
          In attesa di conferma: {pending}. Apri il collegamento che ti abbiamo
          mandato lì: fino ad allora l’indirizzo non è il tuo e non ci arriva
          niente.
        </p>
      ) : sent ? (
        <p role="status" className={noticeClass}>
          Ti abbiamo mandato un messaggio. L’indirizzo diventa il tuo quando
          apri il collegamento che contiene, non prima.
        </p>
      ) : active ? (
        <p className="mt-3 text-[13px] leading-[1.5] text-ink-2">
          È qui che ti scriveremo delle tue prenotazioni. Oggi non mandiamo
          ancora niente: l’indirizzo è la condizione perché i promemoria
          possano partire.
        </p>
      ) : (
        <p className="mt-3 text-[13px] leading-[1.5] text-ink-2">
          Non abbiamo un indirizzo per te. Ci serve per poterti avvisare delle
          tue prenotazioni: oggi non mandiamo ancora niente, ma senza un
          indirizzo i promemoria non potranno partire. Il numero resta quello
          con cui entri.
        </p>
      )}

      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(e) => { e.preventDefault(); setEmail(value) }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[.1em] text-muted">
            {active || pending ? 'Cambia indirizzo email' : 'Il tuo indirizzo email'}
          </span>
          <input
            className="field pointer-coarse:min-h-11"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="nome@esempio.it"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
        <ErrorNote message={error} />
        {/* Nothing to send is not a gesture: the button stays out until
            there is something in the field. */}
        <button
          type="submit"
          disabled={saving || !value.trim()}
          className={primaryButtonClass}
        >
          {saving ? 'Invio…' : 'Salva'}
        </button>
      </form>
    </section>
  )
}

/**
 * Only for an account with no Google identity yet. The risk is named before
 * the gesture, not after (spec §5): Supabase never merges two users, so a
 * second account created by mistake cannot be undone.
 */
function GoogleSection() {
  const { linkGoogle, linking, error } = useLinkGoogle()

  return (
    <section className={`flex flex-col gap-2 ${cardClass}`}>
      <h2 className={sectionTitleClass}>Entrare con Google</h2>
      <p className="text-[13px] leading-[1.5] text-ink-2">
        Google viene collegato all’account qui sopra, e poi entri con l’uno o
        con l’altro. Se invece entri con Google senza collegarlo, nasce un
        secondo account: due account non si possono più unire.
      </p>
      <button
        type="button"
        onClick={linkGoogle}
        disabled={linking}
        className={quietButtonClass}
      >
        {linking ? 'Collegamento…' : 'Collega Google'}
      </button>
      <ErrorNote message={error} />
    </section>
  )
}

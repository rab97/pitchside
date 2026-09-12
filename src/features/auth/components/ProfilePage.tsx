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

// Every control here is meant for a thumb: the floor is the tab bar's, reached
// with `pointer-coarse:` for the reason set out over the admin toolbar
// (`AdminPage.tsx`) — window width answers nothing about what is pointing.
const primaryButtonClass =
  'w-full rounded-lg bg-pitch px-3 py-2.5 text-center text-sm font-medium ' +
  'text-on-pitch transition-colors hover:bg-pitch-strong pointer-coarse:min-h-11'
const quietButtonClass =
  'w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-center ' +
  'text-[13.5px] font-medium text-ink transition-colors hover:border-pitch ' +
  'hover:text-pitch pointer-coarse:min-h-11'

/**
 * The account screen, and the first one this app has ever had for the
 * customer's own account: the number they sign in with, the address we can
 * write to, the other door they may want to attach, and the way out.
 *
 * Il guscio è quello di `MyBookingsPage`: barra alta col titolo su telefono,
 * intestazione della struttura da `lg` in su. Questa è una schermata sorella
 * di quella, non una specie nuova di pagina.
 */
export function ProfilePage(): JSX.Element {
  const facility = useFacility()
  const { session, loading } = useAuth()

  if (loading) return <div className="p-8 text-muted">Caricamento…</div>

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
        {/* Come in `MyBookingsPage`: su telefono il titolo visibile è quello
            della barra alta, e l'`<h1>` resta in `sr-only` perché una pagina
            senza intestazione non dice a chi la ascolta di cosa parla. */}
        <h1 className="sr-only lg:not-sr-only lg:mt-1.5 lg:text-2xl lg:font-semibold lg:tracking-[-.02em]">
          Profilo
        </h1>

        {session ? <Account user={session.user} /> : <Invitation />}
      </main>
    </MobileFrame>
  )
}

/**
 * Il tab c'è sempre, anche per chi non è entrato (§3.1): qui si dice cosa
 * tiene questa schermata e si offre la strada per entrare. Non un rimbalzo
 * altrove, non una porta chiusa — sarebbe l'unico posto dell'app a buttare
 * fuori chi tocca un tab.
 */
function Invitation() {
  return (
    <div className={`mt-6 flex flex-col gap-3 ${cardClass}`}>
      <h2 className="text-[17px] font-semibold tracking-[-.01em]">
        Il tuo account
      </h2>
      <p className="text-[13.5px] leading-[1.55] text-ink-2">
        Qui trovi il numero con cui entri, l’indirizzo a cui mandarti le
        conferme delle prenotazioni e il modo per uscire. Entra per vederli.
      </p>
      <Link to={LOGIN_ROUTE} className={primaryButtonClass}>
        Accedi
      </Link>
    </div>
  )
}

function Account({ user }: { user: User }) {
  // `new_email` è il cambio in sospeso, `email` quello che vale davvero:
  // sono due campi diversi proprio perché sono due cose diverse (§3.2).
  const pending = user.new_email
  const hasGoogle = (user.identities ?? []).some((i) => i.provider === 'google')
  const { signOut, leaving, error } = useSignOut()

  return (
    <div className="mt-6 flex flex-col gap-5">
      <section className={cardClass}>
        <h2 className={sectionTitleClass}>Come entri</h2>
        {/* L'elenco tiene i dati dell'account: quelli che valgono adesso, e
            nient'altro. Un indirizzo in attesa non entra qui — sta nel suo
            avviso, più sotto, e la differenza è il punto di tutta §3.2. */}
        <ul aria-label="Dati dell’account" className="mt-3 flex flex-col gap-2.5">
          <li className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-ink-2">Telefono</span>
            <span className="tabular-nums text-[15px] font-medium">
              {displayPhone(user.phone)}
            </span>
          </li>
          {user.email && (
            <li className="flex items-baseline justify-between gap-3">
              <span className="text-[13px] text-ink-2">Email</span>
              <span className="break-all text-[15px] font-medium">{user.email}</span>
            </li>
          )}
        </ul>
        <p className="mt-3 text-[12px] leading-[1.5] text-muted">
          Il numero è la tua chiave: è con quello che ritrovi lo storico delle
          prenotazioni fatte al telefono.
        </p>
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

/**
 * Tre stati, in quest'ordine: un cambio in attesa, un indirizzo attivo,
 * nessun indirizzo. Il campo resta in tutti e tre — un indirizzo scritto
 * sbagliato, o in attesa su una casella che non si apre più, altrimenti da
 * qui non si correggerebbe, e `updateUser` è lo stesso gesto per entrambi.
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

      {pending ? (
        // `role="status"` e non `alert`: non è un guasto, è un'attesa.
        <p
          role="status"
          className="mt-3 rounded-lg border border-ochre bg-ochre-tint px-3 py-2 text-[12.5px] leading-[1.5] text-ochre"
        >
          In attesa di conferma: {pending}. Apri il collegamento che ti abbiamo
          mandato lì: fino ad allora l’indirizzo non è il tuo e non ci arriva
          niente.
        </p>
      ) : sent ? (
        <p
          role="status"
          className="mt-3 rounded-lg border border-ochre bg-ochre-tint px-3 py-2 text-[12.5px] leading-[1.5] text-ochre"
        >
          Ti abbiamo mandato un messaggio. L’indirizzo diventa il tuo quando
          apri il collegamento che contiene, non prima.
        </p>
      ) : active ? (
        <p className="mt-3 text-[13px] leading-[1.5] text-ink-2">
          Ti scriviamo qui per le conferme delle prenotazioni.
        </p>
      ) : (
        <p className="mt-3 text-[13px] leading-[1.5] text-ink-2">
          Non abbiamo un indirizzo per te. Serve per mandarti le conferme
          delle prenotazioni: il numero resta quello con cui entri.
        </p>
      )}

      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(e) => { e.preventDefault(); setEmail(value) }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-[10.5px] uppercase tracking-[.1em] text-muted">
            {active || pending ? 'Cambia indirizzo' : 'Il tuo indirizzo email'}
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
 * Solo per chi non ha già Google attaccato. Il rischio da nominare prima del
 * gesto, non dopo (§5): Supabase non unisce due account, quindi un secondo
 * account nato per sbaglio non si disfa più.
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

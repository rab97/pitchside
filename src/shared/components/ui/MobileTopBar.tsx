import { Link } from 'react-router-dom'
import { useFacility } from '@/shared/tenant/FacilityProvider'

/**
 * La barra alta delle schermate cliente su telefono: è `.ptop` del mockup
 * (`docs/mockups/02-catalogo-schermate.html`, riga 208) — marchietto della
 * struttura e titolo di cosa si sta facendo — resa fissa in cima.
 *
 * `backTo` distingue le due specie di schermata, come su iOS e in React
 * Native: una radice di tab («Prenota», «Le tue prenotazioni») non ha un
 * «dietro», ci si sposta con la barra dei tab, e mostra il marchietto; una
 * schermata *spinta* — il dettaglio di una prenotazione — mostra al suo
 * posto il chevron che torna indietro.
 *
 * L'indirizzo del ritorno è fisso e **non** `history.back()`: chi arriva da
 * un link, o rientra su una schermata dopo l'accesso via SMS, ha una
 * cronologia che punta fuori dall'app o alla schermata di accesso, e un
 * «indietro nella storia» lo rimanderebbe lì. Un genitore fisso porta sempre
 * dove il titolo promette.
 *
 * Il titolo è un `<p>` e non un `<h1>`: su questa barra passano anche
 * schermate che hanno già la loro intestazione nel contenuto (il dettaglio
 * di una prenotazione mostra l'orario come `<h1>`), e due `<h1>` nella stessa
 * pagina non dicono più quale sia il titolo. Le pagine che invece lasciano il
 * titolo solo a questa barra tengono il proprio `<h1>` in `sr-only`, quindi
 * chi legge con uno screen reader lo trova comunque.
 *
 * Da `lg` in su non esiste: lì c'è l'intestazione col nome della struttura.
 */
export function MobileTopBar({ title, backTo }: {
  title: string
  backTo?: string
}) {
  const facility = useFacility()

  return (
    <header className="fixed inset-x-0 top-0 z-30 flex h-topbar items-center gap-2.5 border-b border-line bg-surface px-2 lg:hidden">
      {backTo ? (
        <Link
          to={backTo}
          aria-label="Torna indietro"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-lg text-ink-2 transition-colors hover:text-pitch"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 18 9 12l6-6" />
          </svg>
        </Link>
      ) : (
        <div
          className="ml-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-md bg-pitch text-[12px] font-semibold text-on-pitch"
          aria-hidden
        >
          {facility.name.charAt(0)}
        </div>
      )}

      <p className="truncate text-[15px] font-semibold tracking-[-.01em]">{title}</p>
    </header>
  )
}

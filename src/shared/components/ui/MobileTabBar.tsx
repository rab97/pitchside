import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

/**
 * Vero quando `pathname` sta *dentro* il tab `to`.
 *
 * Il confronto non può essere un `startsWith` secco: `/prenotazioni`
 * comincia per `/prenota`, e aprendo «le tue prenotazioni» si accenderebbero
 * due tab su tre. Non può nemmeno essere un'uguaglianza secca: il dettaglio
 * di una prenotazione (`/prenotazioni/<id>`) è una schermata spinta *dentro*
 * quel tab, non un posto diverso, e il tab deve restare accesso mentre la si
 * guarda. Quindi: uguale, oppure sotto — con la barra a separare.
 *
 * La home è il caso a parte, perché la sua radice è `/` e «sotto la radice»
 * vorrebbe dire tutta l'app.
 */
export function matchesTab(to: string, pathname: string): boolean {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

/**
 * Icone prese dal mockup (`docs/mockups/02-catalogo-schermate.html`, riga
 * 1885 e seguenti): casa, calendario, e per le prenotazioni fatte il
 * calendario col segno di spunta, che là serviva all'obiettivo «Sempre
 * presente». Sono tracciati, non riempimenti: `stroke="currentColor"` fa
 * prendere all'icona il colore del tab, quindi l'acceso arriva da
 * `--pitch` per costruzione.
 */
const TABS: { to: string; label: string; icon: ReactNode }[] = [
  {
    to: '/',
    label: 'Home',
    icon: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1Z" />,
  },
  {
    to: '/prenota',
    label: 'Prenota',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
  },
  {
    to: '/prenotazioni',
    label: 'Prenotazioni',
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2.5" />
        <path d="M3 10h18M8 3v4M16 3v4M9 15l2 2 4-4" />
      </>
    ),
  },
]

/**
 * La barra dei tab in basso su telefono: `.ptabs` del mockup (riga 281).
 *
 * Il mockup ne disegna cinque — Home, Prenota, Trova, Tornei, Profilo — ma
 * tre di quelle schermate non esistono ancora: i tornei sono la fase 2,
 * «Trova» e «Profilo» vengono dopo. Qui stanno i tre veri: un tab che non
 * porta da nessuna parte insegna a non fidarsi della barra.
 *
 * Le etichette sono in Montserrat e non nel mono del mockup: «Montserrat
 * ovunque» è una decisione successiva a quel file (vedi `--font-sans` in
 * `src/index.css`).
 *
 * L'altezza somma `--spacing-tabbar` e l'incavo di sicurezza in basso —
 * l'app è installabile, e in modalità autonoma su iPhone la barra finirebbe
 * sotto la tacca di sistema. Il riempimento tiene il contenuto sopra
 * l'incavo, mentre il fondo continua fino al bordo dello schermo.
 */
export function MobileTabBar() {
  const { pathname } = useLocation()

  return (
    <nav
      aria-label="Navigazione principale"
      className="fixed inset-x-0 bottom-0 z-30 flex h-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      {TABS.map((tab) => {
        const active = matchesTab(tab.to, pathname)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            aria-current={active ? 'page' : undefined}
            className={
              'flex flex-1 flex-col items-center justify-center gap-[3px] transition-colors ' +
              (active ? 'text-pitch' : 'text-muted hover:text-ink-2')
            }
          >
            <svg
              viewBox="0 0 24 24"
              className="h-[19px] w-[19px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              {tab.icon}
            </svg>
            <span className="text-[9.5px] uppercase tracking-[.04em]">{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}

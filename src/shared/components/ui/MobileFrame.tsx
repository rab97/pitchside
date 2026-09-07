import type { ReactNode } from 'react'
import { MobileTopBar } from './MobileTopBar'
import { MobileTabBar } from './MobileTabBar'

/**
 * Il guscio delle schermate cliente su telefono: barra alta fissa, barra dei
 * tab fissa in basso, e la spaziatura che tiene il contenuto fuori da
 * entrambe. Sta qui e non copiato in ogni pagina perché la spaziatura deve
 * combaciare con l'altezza delle barre, e quattro copie dello stesso calcolo
 * si disallineano alla prima modifica.
 *
 * `title` è opzionale, e la sua assenza vuol dire «questa schermata ha già la
 * sua intestazione»: la home mostra il nome della struttura, che è il posto
 * dove quel nome serve, e prende solo la barra dei tab.
 *
 * `min-h-screen` con `box-sizing: border-box` (il valore di Tailwind)
 * comprende il riempimento: il contenuto ha quindi lo schermo meno le due
 * barre, e non si guadagna uno scorrimento fantasma di un centinaio di pixel
 * su ogni pagina.
 *
 * `fill` è per le schermate che non devono scorrere per intero, ma tenere
 * ferme le proprie parti e far scorrere solo un elenco dentro di sé — la
 * pagina di prenotazione. Lì la pagina è **esattamente** lo schermo e non
 * scorre: chi scorre è il figlio che si dichiara tale. Senza `fill` la
 * pagina è alta almeno lo schermo e scorre tutta, che è quel che serve a un
 * elenco di prenotazioni lungo.
 *
 * L'unità è `dvh` e non `vh`: su un telefono `100vh` è il viewport *grande*,
 * quello senza la barra degli indirizzi, e una schermata alta `100vh` finisce
 * tagliata sotto proprio dove sta il pulsante.
 *
 * Da `lg` in su il guscio non c'è: nessuna barra, nessun riempimento, e le
 * pagine restano quelle di prima al pixel.
 */
export function MobileFrame({ title, backTo, fill = false, children }: {
  title?: string
  backTo?: string
  fill?: boolean
  children: ReactNode
}) {
  return (
    <>
      {title ? <MobileTopBar title={title} backTo={backTo} /> : null}

      <div
        className={
          'bg-ground pb-[calc(var(--spacing-tabbar)+env(safe-area-inset-bottom))] lg:pb-0 ' +
          (title ? 'pt-topbar lg:pt-0 ' : '') +
          (fill
            ? 'h-dvh overflow-hidden lg:h-auto lg:min-h-screen lg:overflow-visible'
            : 'min-h-screen')
        }
      >
        {children}
      </div>

      <MobileTabBar />
    </>
  )
}

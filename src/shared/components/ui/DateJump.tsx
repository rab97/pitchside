import { useRef, useState, type ChangeEvent } from 'react'

// `HTMLInputElement.prototype.showPicker` non è su tutti i browser (Chrome
// 99+, Safari 16+, Firefox 101+): calcolato una sola volta, fuori dal
// componente, perché non cambia mentre l'app gira.
const CAN_SHOW_PICKER = typeof HTMLInputElement !== 'undefined'
  && typeof HTMLInputElement.prototype.showPicker === 'function'

/**
 * Un salto a una data, non un calendario scritto a mano: sotto c'è sempre
 * un `<input type="date">` nativo — stesso controllo già in uso per «Fino
 * al» in `src/features/admin/components/RecurrenceForm.tsx` — così formato,
 * calendario e navigazione restano quelli del browser.
 *
 * Dove il browser lo permette (`CAN_SHOW_PICKER`), l'input non si vede: la
 * data del giorno mostrato è già a schermo altrove (la barra del gestore,
 * l'intestazione del mese sulla striscia del cliente), e il suo
 * `gg/mm/aaaa` la ripeterebbe. Al suo posto un pulsante con un'icona di
 * calendario in SVG inline — la stessa già nel mockup
 * (`docs/mockups/02-catalogo-schermate.html`, riga 1196, «Iscrivere la
 * squadra a un torneo») — che apre lo stesso selettore nativo con
 * `showPicker()`. `stroke="currentColor"` fa sì che l'icona prenda il
 * colore dal tema per costruzione, non da un colore scelto qui: a riposo
 * `text-ink-2`, in hover `hover:text-pitch`, come gli altri controlli
 * secondari del progetto.
 *
 * L'input nativo resta nel DOM, **non** `display: none`: Chromium solleva
 * un'eccezione chiamando `showPicker()` su un elemento non renderizzato.
 * Resta invece piccolo, assoluto e trasparente — renderizzato, ma invisibile
 * — e fuori dal giro del tabulatore (`tabIndex={-1}`, `aria-hidden`): l'unico
 * posto dove si ferma chi naviga da tastiera è il pulsante, che apre lo
 * stesso calendario nativo con Invio o Spazio.
 *
 * Se il browser non ha `showPicker()`, niente pulsante: resta l'input
 * visibile con il suo `gg/mm/aaaa`, che funziona sempre — meglio quello di
 * un'icona elegante che a volte non fa niente.
 */
export function DateJump({ min, max, onSelect, label }: {
  min?: string   // 'yyyy-MM-dd'
  max?: string   // 'yyyy-MM-dd'
  onSelect: (d: Date) => void
  label: string  // aria-label del controllo (pulsante o input, a seconda del browser)
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [supportsPicker] = useState(CAN_SHOW_PICKER)

  function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const value = e.target.value
    if (!value) return
    // Mezzogiorno, non mezzanotte: un istante a mezzanotte UTC può cadere nel
    // giorno prima nel fuso del dispositivo, e il giorno scelto scivolerebbe
    // indietro di uno. Lo stesso accorgimento di `RecurrenceForm.tsx`.
    onSelect(new Date(`${value}T12:00:00`))
  }

  const input = (
    <input
      ref={inputRef}
      type="date"
      aria-label={label}
      aria-hidden={supportsPicker || undefined}
      tabIndex={supportsPicker ? -1 : 0}
      min={min}
      max={max}
      value=""
      onChange={handleChange}
      className={
        supportsPicker
          ? 'absolute h-px w-px overflow-hidden opacity-0'
          : 'h-8 rounded-md border border-line bg-surface px-2 text-[12.5px] tabular-nums text-ink'
      }
    />
  )

  if (!supportsPicker) return input

  return (
    <span className="relative inline-flex">
      {input}
      <button
        type="button"
        title="Scegli una data"
        aria-label={label}
        onClick={() => inputRef.current?.showPicker()}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-surface text-ink-2 transition-colors hover:border-pitch hover:text-pitch"
      >
        <svg
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="5" width="18" height="16" rx="2.5" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
      </button>
    </span>
  )
}

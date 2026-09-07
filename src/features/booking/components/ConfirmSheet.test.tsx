import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmSheet } from './ConfirmSheet'

const field = {
  id: 'c1', name: 'Campo 1', kind: 'calcio5', covered: true, sort_order: 1,
} as never

function renderSheet(over: { price?: number | null; disabled?: boolean } = {}) {
  const onConfirm = vi.fn()
  const utils = render(
    <ConfirmSheet
      field={field}
      day={new Date('2025-10-14T12:00:00+02:00')}
      startMin={1200}
      minutes={60}
      price={over.price === undefined ? 2500 : over.price}
      cancelDeadline={new Date('2025-10-13T20:00:00+02:00')}
      disabled={over.disabled ?? false}
      onConfirm={onConfirm}
    />,
  )
  return { ...utils, onConfirm }
}

describe('ConfirmSheet', () => {
  it('chiuso dice già giorno, ora e importo', () => {
    renderSheet()

    // Mirato sulla maniglia: «20:00» compare anche nella nota della
    // disdetta, e un `getByText` largo pescherebbe quella.
    expect(screen.getByRole('button', { name: 'Mostra il dettaglio' }))
      .toHaveTextContent('mar 14 ott · 20:00–21:00')
    // L'importo si legge senza aprire: lo si cerca nella riga del pulsante,
    // perché le righe del dettaglio — chiuse, ma presenti nel DOM — lo
    // ripetono, ed è giusto che lo ripetano.
    const confirm = screen.getByRole('button', { name: 'Conferma' })
    expect(confirm.parentElement).toHaveTextContent('25,00 €')
    expect(confirm).toBeEnabled()
  })

  it('si apre e si richiude toccando la maniglia', () => {
    renderSheet()

    const handle = screen.getByRole('button', { name: 'Mostra il dettaglio' })
    expect(handle).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(handle)

    const open = screen.getByRole('button', { name: 'Chiudi il dettaglio' })
    expect(open).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByText('Campo 1 · a 5')).toBeInTheDocument()

    fireEvent.click(open)
    expect(screen.getByRole('button', { name: 'Mostra il dettaglio' }))
      .toHaveAttribute('aria-expanded', 'false')
  })

  // Il gesto: `settleDrag` e `heightWhileDragging` sono provate da sole in
  // `utils/sheetDrag.test.ts`, dove si può ragionare sulle distanze. Qui
  // interessa il cablaggio — che il puntatore arrivi a quelle regole, e che
  // un trascinamento non venga poi ribaltato dal `click` che lo segue.
  function drag(el: HTMLElement, from: number, to: number) {
    fireEvent.pointerDown(el, { pointerId: 1, pointerType: 'touch', clientY: from })
    fireEvent.pointerMove(el, { pointerId: 1, pointerType: 'touch', clientY: to })
    fireEvent.pointerUp(el, { pointerId: 1, pointerType: 'touch', clientY: to })
    // Il browser, dopo un puntatore andato e tornato, manda anche un click.
    fireEvent.click(el)
  }

  it('trascinando in su si apre del tutto', () => {
    renderSheet()

    drag(screen.getByRole('button', { name: 'Mostra il dettaglio' }), 700, 560)

    expect(screen.getByRole('button', { name: 'Chiudi il dettaglio' }))
      .toHaveAttribute('aria-expanded', 'true')
  })

  it('trascinando in giù si chiude', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Mostra il dettaglio' }))

    drag(screen.getByRole('button', { name: 'Chiudi il dettaglio' }), 560, 700)

    expect(screen.getByRole('button', { name: 'Mostra il dettaglio' }))
      .toHaveAttribute('aria-expanded', 'false')
  })

  it('un gesto troppo corto lascia il foglio dov’era', () => {
    renderSheet()

    // Dieci pixel: più della tolleranza del tocco, meno della soglia. Non è
    // né un tocco (che aprirebbe) né un trascinamento deciso.
    drag(screen.getByRole('button', { name: 'Mostra il dettaglio' }), 700, 690)

    expect(screen.getByRole('button', { name: 'Mostra il dettaglio' }))
      .toHaveAttribute('aria-expanded', 'false')
  })

  it('un tocco fuori lo richiude, al primo tocco', () => {
    const { container } = renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Mostra il dettaglio' }))

    const velo = container.querySelector('.fixed.inset-0') as HTMLElement
    // `pointerDown` e non `click`: è ciò che su iOS arriva al primo tocco.
    fireEvent.pointerDown(velo, { pointerId: 1, pointerType: 'touch' })

    expect(screen.getByRole('button', { name: 'Mostra il dettaglio' }))
      .toHaveAttribute('aria-expanded', 'false')
  })

  it('Esc lo richiude', () => {
    renderSheet()
    fireEvent.click(screen.getByRole('button', { name: 'Mostra il dettaglio' }))

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.getByRole('button', { name: 'Mostra il dettaglio' }))
      .toHaveAttribute('aria-expanded', 'false')
  })

  it('senza prezzo lo dice e non lascia confermare', () => {
    renderSheet({ price: null, disabled: true })

    expect(screen.getByText('Questo orario non è più disponibile: scegline un altro.'))
      .toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Conferma' })).toBeDisabled()
  })

  it('confermando chiama chi sa cosa fare, non decide da sé', () => {
    const { onConfirm } = renderSheet()

    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})

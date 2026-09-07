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

  it('si apre e si richiude dalla maniglia', () => {
    const { container } = renderSheet()
    const detail = container.querySelector('#confirm-sheet-detail') as HTMLElement

    const handle = screen.getByRole('button', { name: 'Mostra il dettaglio' })
    expect(handle).toHaveAttribute('aria-expanded', 'false')
    // `max-h-0` è il modo in cui il foglio sta chiuso: jsdom non calcola le
    // altezze, e `toBeVisible` non guarda `max-height` — quindi si controlla
    // il meccanismo, oltre al contratto di accessibilità qui sopra.
    expect(detail.className).toContain('max-h-0')

    fireEvent.click(handle)

    const open = screen.getByRole('button', { name: 'Chiudi il dettaglio' })
    expect(open).toHaveAttribute('aria-expanded', 'true')
    expect(detail.className).not.toContain('max-h-0')
    expect(screen.getByText('Campo 1 · a 5')).toBeInTheDocument()

    fireEvent.click(open)
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

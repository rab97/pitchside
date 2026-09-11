import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { NewClosureDialog } from './NewClosureDialog'
import * as conflictsHook from '../hooks/useClosureConflicts'
import type { AdminField } from '../hooks/useAdminFields'

const fields: AdminField[] = [
  {
    id: 'c1', name: 'Campo 1', kind: 'calcio5', surface: 'sintetico',
    covered: true, active: true, sort_order: 1, booking_count: 0,
  },
]

function setPeriod(from: string, to: string) {
  fireEvent.change(screen.getByLabelText('Da'), { target: { value: from } })
  fireEvent.change(screen.getByLabelText('A'), { target: { value: to } })
}

function renderDialog(create = vi.fn()) {
  return render(
    <NewClosureDialog open onClose={() => {}} fields={fields} create={create} />)
}

describe('NewClosureDialog — l’anteprima delle prenotazioni in conflitto', () => {
  it('mentre il controllo è in corso, il pulsante è disattivato e non promette un numero', () => {
    vi.spyOn(conflictsHook, 'useClosureConflicts').mockReturnValue(
      { conflicts: [], isPending: true, error: null } as never)

    renderDialog()
    setPeriod('2026-09-14T19:00', '2026-09-14T22:00')

    const button = screen.getByRole('button', { name: /verifico|chiudi/i })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Verifico…')
  })

  it('se il controllo fallisce, lo dice invece di mostrare «nessuna prenotazione», e il pulsante resta disattivato', () => {
    vi.spyOn(conflictsHook, 'useClosureConflicts').mockReturnValue(
      { conflicts: [], isPending: false, error: new Error('boom') } as never)

    renderDialog()
    setPeriod('2026-09-14T19:00', '2026-09-14T22:00')

    expect(screen.getByText('Non siamo riusciti a controllare le prenotazioni in questo periodo.'))
      .toBeInTheDocument()
    expect(screen.queryByText('Nessuna prenotazione in questo periodo.')).not.toBeInTheDocument()

    const button = screen.getByRole('button', { name: 'Chiudi' })
    expect(button).toBeDisabled()
  })

  it('un periodo scritto al contrario non interroga il database e blocca la conferma', () => {
    const spy = vi.spyOn(conflictsHook, 'useClosureConflicts').mockReturnValue(
      { conflicts: [], isPending: false, error: null } as never)

    renderDialog()
    setPeriod('2026-09-14T22:00', '2026-09-14T19:00')

    expect(screen.getByText("Il periodo non è valido: la fine deve venire dopo l'inizio."))
      .toBeInTheDocument()
    // The hook is still called (React Hooks rules), but with no period to check —
    // `enabled: !!period` inside it keeps this from ever becoming a request.
    const lastCall = spy.mock.calls.at(-1)
    expect(lastCall?.[1]).toBeNull()

    const button = screen.getByRole('button', { name: 'Chiudi' })
    expect(button).toBeDisabled()
  })

  it('con un elenco vero, il pulsante mostra il conteggio ed è attivo', () => {
    vi.spyOn(conflictsHook, 'useClosureConflicts').mockReturnValue({
      conflicts: [{
        id: 'b1', field_id: 'c1', slot_start: new Date('2026-09-14T18:00:00Z'),
        slot_end: new Date('2026-09-14T19:00:00Z'), member_name: 'Giulio Dante',
        member_phone: '3394128807', price_cents: 2500,
      }],
      isPending: false,
      error: null,
    } as never)

    renderDialog()
    setPeriod('2026-09-14T19:00', '2026-09-14T22:00')

    const button = screen.getByRole('button', { name: 'Chiudi e disdici 1 prenotazioni' })
    expect(button).not.toBeDisabled()
  })
})

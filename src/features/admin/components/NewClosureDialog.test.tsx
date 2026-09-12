import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NewClosureDialog } from './NewClosureDialog'
import * as conflictsHook from '../hooks/useClosureConflicts'
import type { AdminField } from '../hooks/useAdminFields'

const fields: AdminField[] = [
  {
    id: 'c1', name: 'Campo 1', kind: 'calcio5', surface: 'sintetico',
    covered: true, active: true, sort_order: 1, booking_count: 0,
  },
]

// Opens a `DateField` (it lands on the current month, thanks to the fixed
// system time below), picks the 14th, then opens the `TimeField` beside it
// and picks the given time.
function pickInstant(dateLabel: string, timeLabel: string, time: string) {
  fireEvent.click(screen.getByRole('button', { name: dateLabel }))
  fireEvent.click(screen.getByRole('button', { name: '14 settembre 2026' }))
  fireEvent.click(screen.getByRole('combobox', { name: timeLabel }))
  fireEvent.click(screen.getByRole('option', { name: time }))
}

// Picks the end instant before the start. With nothing chosen yet, neither
// field carries a bound from the other — the coherence rule runs one way,
// start → end (see NewClosureDialog.tsx) — so this order never lands on a
// disabled option, including for a period that ends up reversed: picking
// forward would grey the very option a "reversed period" test needs to
// reach, since the end TimeField's own min tracks the start once both share
// a day.
function setPeriod(from: string, to: string) {
  pickInstant('Data di fine', 'Ora di fine', to)
  pickInstant('Data di inizio', 'Ora di inizio', from)
}

function renderDialog(create = vi.fn()) {
  return render(
    <NewClosureDialog open onClose={() => {}} fields={fields} create={create} />)
}

describe('NewClosureDialog — l’anteprima delle prenotazioni in conflitto', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-09-01T08:00:00+02:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  // `setPeriod` now drives four separate popovers (two `DateField`s, two
  // `TimeField`s) instead of two synthetic `change` events on native
  // inputs — real work Radix's focus/portal machinery has to do on every
  // open and close. That is comfortably inside the default 5s per test in
  // isolation, but the whole suite runs its ~40 files in parallel, and
  // under that contention this file's tests are the ones that occasionally
  // cross the default timeout — not a hang, just more real time for more
  // real interaction. A longer timeout says so plainly, rather than the
  // suite intermittently failing for a reason no one re-reading it later
  // could see.
  const TIMEOUT = 10_000

  it('mentre il controllo è in corso, il pulsante è disattivato e non promette un numero', () => {
    vi.spyOn(conflictsHook, 'useClosureConflicts').mockReturnValue(
      { conflicts: [], isPending: true, error: null } as never)

    renderDialog()
    setPeriod('19:00', '22:00')

    const button = screen.getByRole('button', { name: /verifico|chiudi/i })
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('Verifico…')
  }, TIMEOUT)

  it('se il controllo fallisce, lo dice invece di mostrare «nessuna prenotazione», e il pulsante resta disattivato', () => {
    vi.spyOn(conflictsHook, 'useClosureConflicts').mockReturnValue(
      { conflicts: [], isPending: false, error: new Error('boom') } as never)

    renderDialog()
    setPeriod('19:00', '22:00')

    expect(screen.getByText('Non siamo riusciti a controllare le prenotazioni in questo periodo.'))
      .toBeInTheDocument()
    expect(screen.queryByText('Nessuna prenotazione in questo periodo.')).not.toBeInTheDocument()

    const button = screen.getByRole('button', { name: 'Chiudi' })
    expect(button).toBeDisabled()
  }, TIMEOUT)

  it('un periodo scritto al contrario non interroga il database e blocca la conferma', () => {
    const spy = vi.spyOn(conflictsHook, 'useClosureConflicts').mockReturnValue(
      { conflicts: [], isPending: false, error: null } as never)

    renderDialog()
    setPeriod('22:00', '19:00')

    expect(screen.getByText('Il periodo non è valido: la fine deve venire dopo l’inizio.'))
      .toBeInTheDocument()
    // The hook is still called (React Hooks rules), but with no period to check —
    // `enabled: !!period` inside it keeps this from ever becoming a request.
    const lastCall = spy.mock.calls.at(-1)
    expect(lastCall?.[1]).toBeNull()

    const button = screen.getByRole('button', { name: 'Chiudi' })
    expect(button).toBeDisabled()
  }, TIMEOUT)

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
    setPeriod('19:00', '22:00')

    // Singular: one booking in the way is the commonest closure there is,
    // and «disdici 1 prenotazioni» is what it used to read.
    const button = screen.getByRole('button', { name: 'Chiudi e disdici 1 prenotazione' })
    expect(button).not.toBeDisabled()
  }, TIMEOUT)

  it('con il solo inizio scelto, il pulsante resta disattivato', () => {
    vi.spyOn(conflictsHook, 'useClosureConflicts').mockReturnValue(
      { conflicts: [], isPending: false, error: null } as never)

    renderDialog()
    // Only the start instant — no `setPeriod`, which would fill both.
    pickInstant('Data di inizio', 'Ora di inizio', '19:00')

    const button = screen.getByRole('button', { name: 'Chiudi' })
    expect(button).toBeDisabled()
  }, TIMEOUT)
})

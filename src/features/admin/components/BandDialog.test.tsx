import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BandDialog } from './BandDialog'
import type { Band } from '../utils/daySegments'

// Opens a `TimeField` beside the given label and picks the given time.
function pickTime(label: string, time: string) {
  fireEvent.click(screen.getByRole('combobox', { name: label }))
  fireEvent.click(screen.getByRole('option', { name: time }))
}

function setPrice(euro: string) {
  fireEvent.change(screen.getByLabelText('Prezzo (€)'), { target: { value: euro } })
}

describe('BandDialog — creazione', () => {
  // `pickTime` opens and closes a real Radix Select popover — focus scope,
  // portal, positioning — and that cost lands almost entirely on whichever
  // test first touches it in this worker (see the 865ms/1226ms/122ms split
  // across this file's three tests in isolation: front-loaded, not evenly
  // spread). Comfortably under the default 5s alone, but the full suite
  // runs its ~45 files in parallel, and under that contention this file's
  // first test has been measured at 4.9s — the same shape
  // `NewClosureDialog.test.tsx` already documents and raises its timeout
  // for. No `userEvent` anywhere in this codebase (`fireEvent` throughout),
  // so there is no inter-event delay to strip; the time is genuine mounting
  // work, not an artificial wait.
  const TIMEOUT = 10_000

  // The guard this test pins: `handleSubmit` refuses to write a band while
  // either `TimeField` is still unset. Delete the `startMin == null ||
  // endMin == null` check in `BandDialog.tsx` and this is the test that
  // goes red — `weekdays.length === 0` alone would let this through, since
  // a weekday is chosen here.
  it('rifiuta di salvare senza un orario di inizio e di fine', () => {
    const saveBand = vi.fn()
    render(
      <BandDialog
        target={{ mode: 'create' }}
        onClose={() => {}}
        bands={[]}
        saveBand={saveBand}
        deleteBand={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'lun' }))
    setPrice('20.00')
    // Only «Alle» is chosen — «Dalle» stays at its unset default.
    pickTime('Alle', '20:00')

    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))

    expect(saveBand).not.toHaveBeenCalled()
    expect(screen.getByText('Scegli l’ora di inizio e l’ora di fine.')).toBeInTheDocument()
  }, TIMEOUT)

  // The companion to the test above: with both times chosen, the same form
  // does save — without this, a guard that refused *everything* (not just
  // an incomplete range) would also make the first test pass.
  it('salva con un orario di inizio e di fine scelti', () => {
    const saveBand = vi.fn().mockResolvedValue(undefined)
    render(
      <BandDialog
        target={{ mode: 'create' }}
        onClose={() => {}}
        bands={[]}
        saveBand={saveBand}
        deleteBand={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('checkbox', { name: 'lun' }))
    setPrice('20.00')
    pickTime('Dalle', '18:00')
    pickTime('Alle', '20:00')

    fireEvent.click(screen.getByRole('button', { name: 'Salva' }))

    expect(saveBand).toHaveBeenCalledWith(
      expect.objectContaining({ startsMin: 1080, endsMin: 1200 }),
    )
  }, TIMEOUT)
})

describe('BandDialog — modifica', () => {
  // Pins the fix from the previous round: editing an existing band must
  // show its real hours, not the `TimeField`s' unset default — the bug
  // that once showed `00:00`/`00:00` for a band that actually ran
  // 09:00–24:00, held now only by `BandForm`'s per-band `key` remount.
  it('precompila le ore vere della fascia', () => {
    const band: Band = { id: 'b1', weekday: 6, startsMin: 540, endsMin: 1440, priceCents: 2800 }
    render(
      <BandDialog
        target={{ mode: 'edit', band }}
        onClose={() => {}}
        bands={[band]}
        saveBand={vi.fn()}
        deleteBand={vi.fn()}
      />,
    )

    expect(screen.getByRole('combobox', { name: 'Dalle' })).toHaveTextContent('09:00')
    expect(screen.getByRole('combobox', { name: 'Alle' })).toHaveTextContent('24:00')
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { format } from 'date-fns'
import { it as itLocale } from 'date-fns/locale'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DateJump } from './DateJump'
import { Dialog } from './Dialog'

const TODAY = new Date('2026-09-11T10:00:00+02:00')

// `DateJump` shares its calendar grid with `DateField` — this file is the
// guard that the extraction into `MonthGridPopover` left `DateJump` itself
// intact: the trigger's own shape, and the two things only it does
// differently from `DateField` (no bound value, `min`/`max` as strings).
describe('DateJump', () => {
  beforeEach(() => vi.setSystemTime(TODAY))
  afterEach(() => vi.useRealTimers())

  it('is an icon button with the fixed tooltip, themed at rest and on hover', () => {
    render(<DateJump onSelect={() => {}} label="Vai a una data" />)
    const button = screen.getByRole('button', { name: 'Vai a una data' })
    expect(button).toHaveAttribute('title', 'Scegli una data')
    expect(button.className).toMatch(/\btext-ink-2\b/)
    expect(button.className).toMatch(/hover:text-pitch/)
  })

  it('opens on the current month, with no day pre-selected', () => {
    render(<DateJump onSelect={() => {}} label="Vai a una data" />)
    fireEvent.click(screen.getByRole('button', { name: 'Vai a una data' }))
    expect(screen.getByText(format(TODAY, 'MMMM yyyy', { locale: itLocale }))).toBeInTheDocument()
    expect(screen.queryByRole('gridcell', { selected: true })).not.toBeInTheDocument()
  })

  it('reports the chosen day at noon, so no timezone can shift it, and closes', () => {
    const onSelect = vi.fn()
    render(<DateJump onSelect={onSelect} label="Vai a una data" />)
    fireEvent.click(screen.getByRole('button', { name: 'Vai a una data' }))
    fireEvent.click(screen.getByRole('button', { name: '15 settembre 2026' }))

    const chosen = onSelect.mock.calls[0][0] as Date
    expect(chosen.getDate()).toBe(15)
    expect(chosen.getHours()).toBe(12)
    // The popover closes on a valid pick — a jump is a one-shot action, not
    // a field that stays open to show what it holds.
    expect(screen.queryByRole('grid')).not.toBeInTheDocument()
  })

  it('refuses a day beyond max', () => {
    render(<DateJump onSelect={() => {}} label="Vai a una data" max="2026-09-13" />)
    fireEvent.click(screen.getByRole('button', { name: 'Vai a una data' }))
    expect(screen.getByRole('button', { name: '20 settembre 2026' })).toBeDisabled()
  })

  it('refuses a day before min', () => {
    render(<DateJump onSelect={() => {}} label="Vai a una data" min="2026-09-11" />)
    fireEvent.click(screen.getByRole('button', { name: 'Vai a una data' }))
    expect(screen.getByRole('button', { name: '7 settembre 2026' })).toBeDisabled()
  })

  it('portals its popover into the enclosing Dialog, not past it', () => {
    // Regression guard for the mechanism `DateField.test.tsx` already pins:
    // a native `<dialog>` lives in the browser's top layer, so a popover
    // defaulting to `document.body` would land outside it, invisible and
    // inert, even though it reports itself open.
    render(
      <Dialog open onClose={() => {}}>
        <DateJump onSelect={() => {}} label="Vai a una data" />
      </Dialog>,
    )
    const dialogElement = screen.getByRole('dialog', { hidden: true })
    fireEvent.click(screen.getByRole('button', { name: 'Vai a una data' }))
    expect(dialogElement.contains(screen.getByRole('grid'))).toBe(true)
  })
})

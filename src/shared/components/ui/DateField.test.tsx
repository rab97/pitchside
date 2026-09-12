import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { DateField } from './DateField'
import { Dialog } from './Dialog'

const sept15 = new Date('2026-09-15T12:00:00+02:00')

describe('DateField', () => {
  it('shows the current value in Italian', () => {
    render(<DateField value={sept15} onChange={() => {}} aria-label="Dal" />)
    expect(screen.getByRole('button', { name: /Dal/ })).toHaveTextContent('15 settembre 2026')
  })

  it('opens on the month of the current value', () => {
    render(<DateField value={sept15} onChange={() => {}} aria-label="Dal" />)
    fireEvent.click(screen.getByRole('button', { name: /Dal/ }))
    expect(screen.getByText(/settembre 2026/i)).toBeInTheDocument()
  })

  it('reports the chosen day at noon, so no timezone can shift it', () => {
    const onChange = vi.fn()
    render(<DateField value={sept15} onChange={onChange} aria-label="Dal" />)

    fireEvent.click(screen.getByRole('button', { name: /Dal/ }))
    // The full date, not the bare day number: a 42-cell grid holds a "18"
    // from this month and could hold one from an adjacent month too, and the
    // accessible name has to disambiguate them — see the comment on the
    // button in DateField.tsx.
    fireEvent.click(screen.getByRole('button', { name: '18 settembre 2026' }))

    const chosen = onChange.mock.calls[0][0] as Date
    expect(chosen.getDate()).toBe(18)
    expect(chosen.getHours()).toBe(12)
  })

  it('refuses a day beyond max', () => {
    render(
      <DateField
        value={sept15}
        onChange={() => {}}
        max={new Date('2026-09-20T12:00:00+02:00')}
        aria-label="Dal"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Dal/ }))
    expect(screen.getByRole('button', { name: '25 settembre 2026' })).toBeDisabled()
  })

  it('keeps the grid reachable by keyboard when the current value is out of range', () => {
    // Regression guard: `focusIndexFor` used to point the roving tabindex at
    // whichever day matched `value`, even when that day was disabled. A
    // disabled native <button> refuses focus, and with every other cell at
    // tabIndex={-1} that left the whole grid unreachable by Tab.
    render(
      <DateField
        value={sept15}
        onChange={() => {}}
        min={new Date('2026-09-20T12:00:00+02:00')}
        max={new Date('2026-09-25T12:00:00+02:00')}
        aria-label="Dal"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Dal/ }))

    const tabbable = document.querySelector('[role="gridcell"] button[tabindex="0"]')
    expect(tabbable).not.toBeNull()
    expect(tabbable).not.toBeDisabled()
    expect(document.activeElement).toBe(tabbable)
  })

  it('keeps something tabbable when no day in the visible month is selectable', () => {
    // The other edge case the same bug produced: a month where min/max block
    // every single day. The grid itself must not swallow focus — it moves to
    // the one control that can get the user somewhere useful, "next month".
    render(
      <DateField
        value={sept15}
        onChange={() => {}}
        max={new Date('2000-01-01T12:00:00+01:00')}
        aria-label="Dal"
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: /Dal/ }))

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Mese successivo' }))
  })

  it('portals its popover into the enclosing Dialog, not past it', () => {
    // Regression guard for the mechanism Task 3 fixed on Select but never
    // pinned with a test: a native <dialog> lives in the browser's top
    // layer, so a popover defaulting to document.body would land outside
    // it — invisible and inert — even though it reports itself open.
    render(
      <Dialog open onClose={() => {}}>
        <DateField value={sept15} onChange={() => {}} aria-label="Dal" />
      </Dialog>,
    )
    const dialogElement = screen.getByRole('dialog', { hidden: true })
    fireEvent.click(screen.getByRole('button', { name: /Dal/ }))
    expect(dialogElement.contains(screen.getByRole('grid'))).toBe(true)
  })
})

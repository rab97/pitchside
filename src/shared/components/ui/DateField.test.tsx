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
    fireEvent.click(screen.getByRole('button', { name: '18' }))

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
    expect(screen.getByRole('button', { name: '25' })).toBeDisabled()
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

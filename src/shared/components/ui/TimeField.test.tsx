import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { TimeField } from './TimeField'

describe('TimeField', () => {
  it('shows a placeholder when nothing is chosen, not a real time', () => {
    // `0` would be `00:00` — a legitimate, submittable instant — so a
    // field with nothing chosen has to hold `null`, not `0`, or a manager
    // who never touched it would silently save midnight.
    render(<TimeField value={null} onChange={() => {}} aria-label="Dalle" />)
    expect(screen.getByRole('combobox', { name: 'Dalle' })).toHaveTextContent('--:--')
  })

  it('reports minutes when a value is chosen from an unset field', () => {
    const onChange = vi.fn()
    render(<TimeField value={null} onChange={onChange} aria-label="Dalle" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Dalle' }))
    fireEvent.click(screen.getByRole('option', { name: '09:15' }))

    expect(onChange).toHaveBeenCalledWith(555)
  })

  it('shows the current minute as a time', () => {
    render(<TimeField value={1140} onChange={() => {}} aria-label="Dalle" />)
    expect(screen.getByRole('combobox', { name: 'Dalle' })).toHaveTextContent('19:00')
  })

  it('offers midnight as an end, which no native time input could', () => {
    render(<TimeField value={1440} onChange={() => {}} min={15} max={1440} aria-label="Alle" />)
    expect(screen.getByRole('combobox', { name: 'Alle' })).toHaveTextContent('24:00')
  })

  it('reports minutes, not a label', () => {
    const onChange = vi.fn()
    render(<TimeField value={540} onChange={onChange} aria-label="Dalle" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Dalle' }))
    fireEvent.click(screen.getByRole('option', { name: '09:15' }))

    expect(onChange).toHaveBeenCalledWith(555)
  })

  it('greys what is out of bounds instead of hiding it', () => {
    // Spec §3.1. The whole day is still listed; only what cannot be chosen
    // right now is disabled. A test asserting a shorter list would be
    // asserting the old behaviour.
    render(<TimeField value={0} onChange={() => {}} min={0} max={60} step={30} aria-label="Dalle" />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Dalle' }))

    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(49) // 00:00 … 24:00 every 30 minutes
    expect(screen.getByRole('option', { name: '01:00' })).not.toHaveAttribute('data-disabled')
    expect(screen.getByRole('option', { name: '01:30' })).toHaveAttribute('data-disabled')
  })

  it('cannot end at or before it starts', () => {
    // The relational rule of spec §3.1: an end field whose `min` is the start
    // plus one step greys the start itself, because a band of zero length is
    // not a band.
    render(<TimeField value={1440} onChange={() => {}} min={180} step={15} aria-label="Alle" />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Alle' }))

    expect(screen.getByRole('option', { name: '02:45' })).toHaveAttribute('data-disabled')
    expect(screen.getByRole('option', { name: '03:00' })).not.toHaveAttribute('data-disabled')
  })
})

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'

const options = [
  { value: 'calcio5', label: 'Calcio a 5' },
  { value: 'calcio7', label: 'Calcio a 7' },
]

describe('Select', () => {
  it('shows the label of the current value, not its code', () => {
    render(<Select value="calcio7" onChange={() => {}} options={options} aria-label="Tipo" />)
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toHaveTextContent('Calcio a 7')
  })

  it('reports the chosen value', () => {
    const onChange = vi.fn()
    render(<Select value="calcio5" onChange={onChange} options={options} aria-label="Tipo" />)

    fireEvent.click(screen.getByRole('combobox', { name: 'Tipo' }))
    fireEvent.click(screen.getByRole('option', { name: 'Calcio a 7' }))

    expect(onChange).toHaveBeenCalledWith('calcio7')
  })

  it('is a combobox a screen reader can name', () => {
    render(<Select value="calcio5" onChange={() => {}} options={options} aria-label="Tipo di campo" />)
    expect(screen.getByRole('combobox', { name: 'Tipo di campo' })).toBeInTheDocument()
  })

  it('cannot be opened when disabled', () => {
    render(<Select value="calcio5" onChange={() => {}} options={options} aria-label="Tipo" disabled />)
    expect(screen.getByRole('combobox', { name: 'Tipo' })).toBeDisabled()
  })
})

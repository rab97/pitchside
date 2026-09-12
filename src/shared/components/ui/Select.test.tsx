import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { tapTarget } from '@/test/tailwindBox'
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

  // The keyboard focus ring `.field` carries (`src/index.css`) is argued
  // there against the one state that could make it wrong: a trigger still
  // focused while its listbox is open would ring underneath a panel sitting
  // flush against it. The argument is that this state does not occur —
  // Radix's `focusFirst` moves focus to the selected item as soon as the
  // popper reports itself positioned. That is a claim about a library, so it
  // is asserted rather than trusted; if a later version stops doing it, the
  // comment in the stylesheet is the thing that goes stale, and this is what
  // notices. Positioning happens a tick after the click, so the check is
  // asynchronous — synchronously, right after `fireEvent.click`, focus is
  // still on the trigger and always was.
  it('hands focus to the open list, so the trigger is never ringed under it', async () => {
    render(<Select value="calcio5" onChange={() => {}} options={options} aria-label="Tipo" />)

    const trigger = screen.getByRole('combobox', { name: 'Tipo' })
    fireEvent.click(trigger)

    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'Calcio a 5' })).toHaveFocus()
    })
    expect(trigger).not.toHaveFocus()
  })

  // `TimeField` is a `Select` of 97 rows, and the row is where a time gets
  // picked on a phone. At the ~37px `px-3 py-2` produced, the finger lands
  // between two of them and the wrong one is chosen. Measured from a real
  // Tailwind compile over the classes the rendered row carries — see
  // `src/test/tailwindBox.ts` — because jsdom performs no layout and drops
  // `@media (pointer: coarse)` outright.
  it('gives an option row the 44px floor on a touch device', async () => {
    render(<Select value="calcio5" onChange={() => {}} options={options} aria-label="Tipo" />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Tipo' }))

    const row = screen.getByRole('option', { name: 'Calcio a 7' })
    const { height } = await tapTarget(row, 'coarse')

    expect(height).toEqual(expect.any(Number))
    expect(height).toBeGreaterThanOrEqual(44)
  })

  it('leaves the row its dense height under a mouse', async () => {
    render(<Select value="calcio5" onChange={() => {}} options={options} aria-label="Tipo" />)
    fireEvent.click(screen.getByRole('combobox', { name: 'Tipo' }))

    // Nothing declares a height here: the row is as tall as its padding plus
    // its line box, ~37px, which is the desktop list this fix deliberately
    // does not grow — 97 rows at 44px is 4268px of scrolling. `null` is the
    // honest answer, and it is also the assertion that the variant did not
    // quietly become unconditional.
    const row = screen.getByRole('option', { name: 'Calcio a 7' })
    expect(await tapTarget(row, 'fine')).toEqual({ width: null, height: null })
  })
})

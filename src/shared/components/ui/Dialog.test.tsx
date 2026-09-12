import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Dialog } from './Dialog'

/**
 * `Dialog` is shared by every dialog in the manager's panel, so the one change
 * made here for the booking dialog — pinning the box's top edge while the
 * member search resizes it — has to be provably invisible to the others.
 * These two assertions are that proof: they pin the default, which is what
 * every other consumer renders because none of them passes `align`.
 */
describe('Dialog', () => {
  it('senza `align` resta centrato, come lo erano tutti', () => {
    render(<Dialog open onClose={() => {}} labelledBy="t"><p id="t">contenuto</p></Dialog>)
    const dialog = screen.getByText('contenuto').closest('dialog')
    expect(dialog).toHaveClass('m-auto')
  })

  it('con `align="top"` il bordo superiore è fisso e l’altezza è limitata', () => {
    render(<Dialog open onClose={() => {}} labelledBy="t" align="top"><p id="t">contenuto</p></Dialog>)
    const dialog = screen.getByText('contenuto').closest('dialog')
    expect(dialog).not.toHaveClass('m-auto')
    expect(dialog).toHaveClass('mx-auto', 'my-[6vh]', 'max-h-[88vh]')
  })
})

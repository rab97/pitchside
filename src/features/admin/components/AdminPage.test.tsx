import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { tapTarget } from '@/test/tailwindBox'
import { AdminPage } from './AdminPage'

// Everything below the toolbar talks to Supabase; this file is about the
// toolbar's geometry, so the grid and the two dialogs are replaced wholesale.
vi.mock('./DayGrid', () => ({ DayGrid: () => <div data-testid="day-grid" /> }))
vi.mock('./NewBookingDialog', () => ({ NewBookingDialog: () => null }))
vi.mock('./BookingDetailDialog', () => ({ BookingDetailDialog: () => null }))
vi.mock('@/shared/hooks/useFields', () => ({ useFields: () => ({ fields: [] }) }))

vi.mock('@/shared/tenant/FacilityProvider', () => ({
  useFacility: () => ({
    id: 'f1', slug: 'test', name: 'Palacalcetto', color: '#146B3F',
    phone: null, address: null, cancel_hours: 6, booking_horizon_days: 14,
    slot_minutes: 30, min_duration_minutes: 60, features: {},
  }),
}))

// spec §2.4: "touch targets no smaller than the tab bar's".
const FLOOR = 44

// Every control of the toolbar, by the name a person reaches it with.
const CONTROLS = [
  'Giorno precedente',
  'Giorno successivo',
  'Torna a oggi',
  'Vai a una data',
  'Impostazioni',
]

/**
 * The defect this guards: the author could not tap «Impostazioni» on a
 * phone. The cause was size — four of the five controls in this row were
 * under the floor, the arrows at 24×24 — and the reason nobody noticed is
 * that nothing here was ever measured. So this measures, and it measures
 * all five: fixing only the control that was reported would leave the same
 * trap one button along.
 *
 * The numbers come out of a real Tailwind compile over the classes each
 * element actually carries (see `src/test/tailwindBox.ts`), because jsdom
 * neither lays out nor evaluates `@media` — and `(pointer: coarse)` is
 * precisely the branch that matters.
 */
describe('AdminPage — la barra della giornata sotto un dito', () => {
  function renderPage() {
    return render(<MemoryRouter initialEntries={['/admin']}><AdminPage /></MemoryRouter>)
  }

  it.each(CONTROLS)('«%s» misura almeno 44×44 su un dispositivo tattile', async (name) => {
    renderPage()
    const control = screen.getByRole(name === 'Impostazioni' ? 'link' : 'button', { name })

    const { width, height } = await tapTarget(control, 'coarse')

    // `null` would mean nothing in the class list declares a floor on that
    // axis — a control sized by its own text, which is not something a test
    // can hold to a minimum. Saying so out loud beats passing silently.
    expect({ name, width, height }).toEqual({
      name,
      width: expect.any(Number),
      height: expect.any(Number),
    })
    expect(width).toBeGreaterThanOrEqual(FLOOR)
    expect(height).toBeGreaterThanOrEqual(FLOOR)
  })

  it('lascia la barra compatta quando a puntare è un mouse', async () => {
    renderPage()
    const previous = screen.getByRole('button', { name: 'Giorno precedente' })

    // The other half of the choice: `pointer-coarse:` enlarges where a
    // finger is used and leaves a dense desktop toolbar alone. If this ever
    // reads 44, the variant has been replaced by something unconditional
    // and the desktop bar has quietly grown.
    expect(await tapTarget(previous, 'fine')).toEqual({ width: 24, height: 24 })
  })
})

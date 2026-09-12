import { act, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { FieldsPage } from './FieldsPage'
import { useAdminFields, type AdminField } from '../hooks/useAdminFields'

// `useAdminFields` talks to Supabase and React Query; this file is about
// `FieldsPage`'s own state, so the hook is replaced wholesale rather than
// wired up for real.
vi.mock('../hooks/useAdminFields', () => ({ useAdminFields: vi.fn() }))

// `SortableList` owns the actual pointer/touch/keyboard gesture, which is
// exercised in the browser, not in jsdom (see the task report). Standing in
// for it here isolates the bug this file targets: whether `FieldsPage`
// keeps trusting a `onReorder` snapshot after the write behind it settles.
// The stand-in renders every item and exposes a single button that reports
// the list reversed, as a real drop would report some new order.
//
// It renders the `<ul>` itself, and takes the `className` for it, because
// that is the real component's contract now: the list element belongs to
// `SortableList`, so that dnd-kit's inline live region cannot land inside
// it. A stand-in that left the `<ul>` to the caller would describe a shape
// the app no longer has. The trigger button sits *outside* the list for the
// same reason — it is not an `<li>`, and a mock has no business
// reintroducing the defect its own component was moved to prevent.
vi.mock('@/shared/components/ui/SortableList', () => ({
  SortableList: ({ items, onReorder, renderItem, className }: {
    items: AdminField[]
    onReorder: (next: AdminField[]) => void
    renderItem: (item: AdminField, handle: { ref: () => void; attributes: object; listeners: object }) => React.ReactNode
    className?: string
  }) => (
    <>
      <ul className={className}>
        {items.map((item) => <li key={item.id}>{renderItem(item, { ref: () => {}, attributes: {}, listeners: {} })}</li>)}
      </ul>
      <button onClick={() => onReorder([...items].reverse())}>simula trascinamento</button>
    </>
  ),
}))

vi.mock('@/shared/tenant/FacilityProvider', () => ({
  useFacility: () => ({
    id: 'f1', slug: 'test', name: 'Palacalcetto', color: '#146B3F',
    phone: null, address: null, cancel_hours: 6, booking_horizon_days: 14,
    slot_minutes: 30, min_duration_minutes: 60, features: {},
  }),
}))

const campo1: AdminField = {
  id: 'c1', name: 'Campo 1', kind: 'calcio5', surface: 'sintetico',
  covered: true, active: true, sort_order: 1, booking_count: 0,
}
const campo2: AdminField = {
  id: 'c2', name: 'Campo 2', kind: 'calcio5', surface: 'sintetico',
  covered: false, active: true, sort_order: 2, booking_count: 0,
}

function mockAdminFields(fields: AdminField[], reorderFields: (patches: { id: string; sort_order: number }[]) => Promise<void>) {
  vi.mocked(useAdminFields).mockReturnValue({
    fields, isPending: false, error: null,
    create: vi.fn(), update: vi.fn(), remove: vi.fn(),
    reorderFields,
  })
}

function renderPage() {
  return render(<MemoryRouter initialEntries={['/admin/campi']}><FieldsPage /></MemoryRouter>)
}

describe('FieldsPage — l’ordine dopo un trascinamento riuscito', () => {
  // The case that shipped broken: a successful drag left `order` set
  // forever, so `displayFields = order ?? fields` kept resolving to that
  // frozen snapshot no matter what `fields` did afterwards — a rename
  // through «Modifica», a toggle, a new pitch, all invisible without a full
  // page reload. The fix clears `order` once the write settles, whichever
  // way; this test drags successfully, then has the underlying data change
  // (as a real `Modifica` save or query refetch would), and insists the
  // screen shows it.
  it('shows a later change to the data, not the order captured at drop time', async () => {
    const reorderFields = vi.fn().mockResolvedValue(undefined)
    mockAdminFields([campo1, campo2], reorderFields)

    const { rerender } = renderPage()

    await act(async () => {
      screen.getByRole('button', { name: 'simula trascinamento' }).click()
      // Let the mutation's promise (and the `finally` after it) resolve.
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(reorderFields).toHaveBeenCalledWith([
      { id: 'c2', sort_order: 1 },
      { id: 'c1', sort_order: 2 },
    ])

    // Simulate the invalidated query coming back with a name changed in the
    // meantime — the same shape of update a save in the edit dialog, or
    // another admin's own edit, would produce.
    const renamed = { ...campo1, name: 'Campo 1 (rinominato)' }
    mockAdminFields([campo2, renamed], reorderFields)
    rerender(<MemoryRouter initialEntries={['/admin/campi']}><FieldsPage /></MemoryRouter>)

    expect(screen.getByText('Campo 1 (rinominato)')).toBeInTheDocument()
    expect(screen.queryByText('Campo 1')).not.toBeInTheDocument()
  })
})

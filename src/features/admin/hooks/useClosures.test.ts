import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { listClosures, deleteSelect, rpcMock, fromMock } = vi.hoisted(() => {
  const listClosures = vi.fn()
  const deleteSelect = vi.fn()
  const rpcMock = vi.fn()
  const fromMock = vi.fn(() => ({
    select: () => ({ eq: listClosures }),
    delete: () => ({ eq: () => ({ select: deleteSelect }) }),
  }))
  return { listClosures, deleteSelect, rpcMock, fromMock }
})

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock, rpc: rpcMock } }))

vi.mock('@/shared/tenant/FacilityProvider', () => ({
  useFacility: () => ({
    id: 'f1', slug: 'test', name: 'Palacalcetto', color: '#146B3F',
    phone: null, address: null, cancel_hours: 6, booking_horizon_days: 14,
    slot_minutes: 30, min_duration_minutes: 60, features: {},
  }),
}))

import { useClosures } from './useClosures'

describe('useClosures', () => {
  let qc: QueryClient
  let invalidate: ReturnType<typeof vi.spyOn>

  function wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children)
  }

  beforeEach(() => {
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    })
    invalidate = vi.spyOn(qc, 'invalidateQueries')
    listClosures.mockResolvedValue({ data: [], error: null })
    deleteSelect.mockResolvedValue({ data: [{ id: 'x1' }], error: null })
    rpcMock.mockResolvedValue({ data: 2, error: null })
  })

  // `create_closure` cancels every booking inside the period, in the same
  // transaction. Three cached queries read a booking, on three screens, and
  // all three are wrong the instant this returns. `busy` is the one that had
  // been missed: `busy_slots` is a view over `bookings where status =
  // 'active'`, and it is what tells a customer on `/prenota` that a slot is
  // taken — so without it the app kept offering slots it had just freed, and
  // kept hiding a closure it had just made.
  it('frees the customer availability a new closure just cancelled', async () => {
    const { result } = renderHook(() => useClosures(), { wrapper })

    await act(async () => {
      await result.current.create({
        fieldId: null,
        from: new Date('2026-09-20T08:00:00Z'),
        to: new Date('2026-09-20T12:00:00Z'),
        reason: 'tubo rotto',
      })
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['closures', 'f1'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['bookings', 'f1'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['busy', 'f1'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['closure-conflicts', 'f1'] })
  })

  // The other half of the rule, and the reason this one is not symmetrical:
  // removing a closure reopens the period but restores no booking — that is
  // what `ClosuresPage` promises before the manager confirms — so nothing
  // outside this list has changed, and invalidating more would be noise.
  it('touches only its own list when a closure is removed', async () => {
    const { result } = renderHook(() => useClosures(), { wrapper })

    await act(async () => {
      await result.current.remove('x1')
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['closures', 'f1'] })
    expect(invalidate).toHaveBeenCalledTimes(1)
  })
})

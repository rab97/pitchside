import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Built with `vi.hoisted` so the hoisted mock factory and the test bodies
// share the same function references — the same reason `useUpdateFacility`'s
// test does it.
const { orderByStart, insertSelect, fromMock } = vi.hoisted(() => {
  const orderByStart = vi.fn()
  const insertSelect = vi.fn()
  const fromMock = vi.fn(() => ({
    select: () => ({ eq: () => ({ order: () => ({ order: orderByStart }) }) }),
    insert: () => ({ select: insertSelect }),
  }))
  return { orderByStart, insertSelect, fromMock }
})

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))

vi.mock('@/shared/tenant/FacilityProvider', () => ({
  useFacility: () => ({
    id: 'f1', slug: 'test', name: 'Palacalcetto', color: '#146B3F',
    phone: null, address: null, cancel_hours: 6, booking_horizon_days: 14,
    slot_minutes: 30, min_duration_minutes: 60, features: {},
  }),
}))

import { usePriceBands } from './usePriceBands'

describe('usePriceBands', () => {
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
    orderByStart.mockResolvedValue({ data: [], error: null })
    insertSelect.mockResolvedValue({ data: [{ id: 'b1' }], error: null })
    fromMock.mockClear()
  })

  // The case that shipped broken: the band write refreshed only the panel's
  // own list, so a manager who changed a price and opened `/prenota` to check
  // it — the path `FieldsPage`'s link to this screen invites — was shown the
  // price from before and had no way to tell which one was real. `slot_prices`
  // is computed from these rows, so writing one changes that query's answer.
  it('invalidates the customer price query too, not only its own bands', async () => {
    const { result } = renderHook(() => usePriceBands('c1'), { wrapper })

    await act(async () => {
      await result.current.saveBand({
        weekdays: [1], startsMin: 18 * 60, endsMin: 20 * 60, priceCents: 3000,
      })
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['price-bands', 'c1'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['slot-prices', 'c1'] })
  })

  it('invalidates both after a delete as well', async () => {
    const { result } = renderHook(() => usePriceBands('c1'), { wrapper })
    insertSelect.mockResolvedValue({ data: [{ id: 'b1' }], error: null })
    fromMock.mockReturnValue({
      select: () => ({ eq: () => ({ order: () => ({ order: orderByStart }) }) }),
      insert: () => ({ select: insertSelect }),
      delete: () => ({ in: () => ({ select: () => Promise.resolve({ data: [{ id: 'b1' }], error: null }) }) }),
    } as never)

    await act(async () => {
      await result.current.deleteBand(['b1'])
    })

    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['price-bands', 'c1'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['slot-prices', 'c1'] })
  })
})

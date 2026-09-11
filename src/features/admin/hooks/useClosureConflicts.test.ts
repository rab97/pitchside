import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The chain is built with `vi.hoisted` so the mock factory below (hoisted by
// Vitest above the imports) and the test bodies share the same references —
// the factory cannot close over plain `const`s declared after it. The
// builder mimics the shape `useClosureConflicts` actually calls
// (`.select().eq().eq().overlaps()`, then an optional extra `.eq()`) and is
// itself thenable, the same way a real PostgREST query builder is: `await
// query` resolves it without a final `.select()`/`.single()` call.
const { fromMock, setResult } = vi.hoisted(() => {
  let resultPromise: Promise<{ data: unknown; error: unknown }> =
    Promise.resolve({ data: [], error: null })
  const builder: Record<string, unknown> = {}
  builder.select = () => builder
  builder.eq = () => builder
  builder.overlaps = () => builder
  builder.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    resultPromise.then(resolve, reject)
  const fromMock = vi.fn(() => builder)
  return {
    fromMock,
    setResult: (p: Promise<{ data: unknown; error: unknown }>) => { resultPromise = p },
  }
})

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))
vi.mock('@/shared/tenant/FacilityProvider', () => ({
  useFacility: () => ({ id: 'f1' }),
}))

// `vi.mock` calls above are hoisted above every import in this file,
// this one included — the mocks are in place before the hook is evaluated.
import { useClosureConflicts } from './useClosureConflicts'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useClosureConflicts', () => {
  beforeEach(() => {
    fromMock.mockClear()
  })

  // This is the exact regression the review round caught: `useQuery`'s own
  // `isPending` is true for a *disabled* query too (no data, no error, never
  // asked to run) — reporting that as "pending" is what let the dialog show
  // a "still verifying" button before a manager had even chosen a period.
  it('senza un periodo non interroga il database, e non è "in corso"', () => {
    setResult(Promise.resolve({ data: [], error: null }))
    const { result } = renderHook(() => useClosureConflicts(null, null), { wrapper })

    expect(result.current.isPending).toBe(false)
    expect(result.current.conflicts).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('con un periodo, interroga bookings e restituisce i conflitti', async () => {
    setResult(Promise.resolve({
      data: [{
        id: 'b1', field_id: 'c1',
        slot: '["2026-09-14 18:00:00+00","2026-09-14 19:00:00+00")',
        price_cents: 2500,
        members: { name: 'Giulio Dante', phone: '3394128807' },
      }],
      error: null,
    }))

    const { result } = renderHook(() => useClosureConflicts('c1', {
      from: new Date('2026-09-14T17:00:00Z'),
      to: new Date('2026-09-14T20:00:00Z'),
    }), { wrapper })

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(fromMock).toHaveBeenCalledWith('bookings')
    expect(result.current.conflicts).toHaveLength(1)
    expect(result.current.conflicts[0]).toMatchObject({
      id: 'b1', field_id: 'c1', member_name: 'Giulio Dante',
      member_phone: '3394128807', price_cents: 2500,
    })
  })

  it('quando la select fallisce, restituisce l’errore invece di far finta di nulla', async () => {
    setResult(Promise.resolve({ data: null, error: new Error('rete assente') }))

    const { result } = renderHook(() => useClosureConflicts(null, {
      from: new Date('2026-09-14T17:00:00Z'),
      to: new Date('2026-09-14T20:00:00Z'),
    }), { wrapper })

    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(result.current.error).toBeTruthy()
    expect(result.current.conflicts).toEqual([])
  })
})

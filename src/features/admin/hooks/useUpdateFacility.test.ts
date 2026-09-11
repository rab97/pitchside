import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The chain is built with `vi.hoisted` so the mock factory below (hoisted by
// Vitest above the imports) and the test bodies share the same function
// references — the factory cannot close over plain `const`s declared after it.
const { singleMock, selectMock, eqMock, updateMock, fromMock } = vi.hoisted(() => {
  const singleMock = vi.fn()
  const selectMock = vi.fn(() => ({ single: singleMock }))
  const eqMock = vi.fn(() => ({ select: selectMock }))
  const updateMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ update: updateMock }))
  return { singleMock, selectMock, eqMock, updateMock, fromMock }
})

vi.mock('@/shared/lib/supabase', () => ({
  supabase: { from: fromMock },
}))

vi.mock('@/shared/tenant/FacilityProvider', () => ({
  useFacility: () => ({
    id: 'f1', slug: 'test', name: 'Palacalcetto', color: '#146B3F',
    phone: null, address: null, cancel_hours: 6, booking_horizon_days: 14,
    slot_minutes: 30, min_duration_minutes: 60, features: {},
  }),
}))

// `vi.mock` calls above are hoisted by Vitest above every import in this
// file, this one included — the mocks are in place before `useUpdateFacility`
// is evaluated.
import { useUpdateFacility } from './useUpdateFacility'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useUpdateFacility', () => {
  beforeEach(() => {
    singleMock.mockReset()
    fromMock.mockClear()
    updateMock.mockClear()
    eqMock.mockClear()
    selectMock.mockClear()
  })

  it('salva quando la riga torna aggiornata', async () => {
    singleMock.mockResolvedValue({ data: { id: 'f1' }, error: null })
    const { result } = renderHook(() => useUpdateFacility(), { wrapper })

    await act(async () => {
      await expect(result.current.save({ name: 'Nuovo nome' })).resolves.toBeUndefined()
    })
    expect(fromMock).toHaveBeenCalledWith('facilities')
  })

  it('fallisce quando PostgREST segnala un errore', async () => {
    singleMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { result } = renderHook(() => useUpdateFacility(), { wrapper })

    await act(async () => {
      await expect(result.current.save({ name: 'Nuovo nome' })).rejects.toThrow()
    })
  })

  // The case that shipped broken: RLS excludes the row from the `USING`
  // clause (expired session, revoked admin, mismatched facility), the update
  // touches zero rows, and PostgREST reports no error for it. Without this
  // test the hook would go back to saying "saved" while writing nothing.
  it('fallisce quando l’update non tocca nessuna riga, anche senza errore', async () => {
    singleMock.mockResolvedValue({ data: null, error: null })
    const { result } = renderHook(() => useUpdateFacility(), { wrapper })

    await act(async () => {
      await expect(result.current.save({ name: 'Nuovo nome' })).rejects.toThrow()
    })
  })
})

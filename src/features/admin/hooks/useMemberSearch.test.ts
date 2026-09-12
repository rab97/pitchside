import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

vi.mock('@/shared/tenant/FacilityProvider', () => ({
  useFacility: () => ({ id: 'f1' }),
}))

import { useMemberSearch } from './useMemberSearch'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useMemberSearch', () => {
  it('non interroga il database sotto i due caratteri', async () => {
    const { result } = renderHook(() => useMemberSearch('R'), { wrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(rpcMock).not.toHaveBeenCalled()
    expect(result.current.results).toEqual([])
  })

  it('mappa le righe e segnala chi ha una mancata presentazione', async () => {
    rpcMock.mockResolvedValue({
      data: [{ id: 'm1', name: 'Rossi Luca', phone: '3331112233', has_missed: true, rank: 1 }],
      error: null,
    })
    const { result } = renderHook(() => useMemberSearch('Rossi'), { wrapper })
    await waitFor(() => expect(result.current.results).toHaveLength(1))
    expect(result.current.results[0]).toEqual({
      id: 'm1',
      name: 'Rossi Luca',
      phone: '3331112233',
      hasMissed: true,
    })
    expect(result.current.failed).toBe(false)
  })

  it('se la ricerca fallisce lo dice con `failed`, senza risultati e senza lanciare', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { result } = renderHook(() => useMemberSearch('Rossi'), { wrapper })
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.results).toEqual([])
  })
})

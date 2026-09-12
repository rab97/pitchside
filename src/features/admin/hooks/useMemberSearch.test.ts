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

/**
 * The wrapper above builds a new `QueryClient` on every render, which is
 * harmless for a hook rendered once and fatal for anything that has to see
 * what the previous query key left in the cache: `rerender` would hand the
 * hook an empty cache and the test would pass for the wrong reason. These two
 * keep one client for the life of the test.
 */
function makeWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: qc }, children)
  }
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

  // The regression that made the dialog flutter: each keystroke is a new query
  // key, `data` is undefined for it, `results` went back to `[]`, and the
  // <ul> in `MemberSearchField` unmounted and remounted once per character —
  // moving everything below it, and the modal with it. A human eye would have
  // to re-check this by hand every time; this is the check.
  it('digitando un altro carattere la lista non si svuota mentre arriva la risposta', async () => {
    const row = { id: 'm1', name: 'Rossi Luca', phone: '3331112233', has_missed: false, rank: 3 }
    rpcMock.mockResolvedValue({ data: [row], error: null })
    const { result, rerender } = renderHook(({ q }) => useMemberSearch(q), {
      wrapper: makeWrapper(), initialProps: { q: 'Ro' },
    })
    await waitFor(() => expect(result.current.results).toHaveLength(1))

    // The answer to the next keystroke never arrives, so the assertion below
    // is about the window between the key and the response — the only window
    // in which the list used to be empty.
    rpcMock.mockReturnValue(new Promise(() => {}))
    rerender({ q: 'Ros' })
    await waitFor(() => expect(rpcMock).toHaveBeenCalledTimes(2))
    expect(result.current.results).toHaveLength(1)
  })

  it('svuota la lista quando il campo scende sotto i due caratteri', async () => {
    const row = { id: 'm1', name: 'Rossi Luca', phone: '3331112233', has_missed: false, rank: 3 }
    rpcMock.mockResolvedValue({ data: [row], error: null })
    const { result, rerender } = renderHook(({ q }) => useMemberSearch(q), {
      wrapper: makeWrapper(), initialProps: { q: 'Ro' },
    })
    await waitFor(() => expect(result.current.results).toHaveLength(1))

    rerender({ q: '' })
    await waitFor(() => expect(result.current.results).toEqual([]))
  })

  it('non manda una richiesta per ogni tasto: aspetta che la digitazione si fermi', async () => {
    rpcMock.mockResolvedValue({ data: [], error: null })
    const { rerender } = renderHook(({ q }) => useMemberSearch(q), {
      wrapper: makeWrapper(), initialProps: { q: 'Ro' },
    })
    rerender({ q: 'Ros' })
    rerender({ q: 'Ross' })
    rerender({ q: 'Rossi' })

    await waitFor(() => expect(rpcMock).toHaveBeenCalled())
    expect(rpcMock).toHaveBeenCalledTimes(1)
    expect(rpcMock.mock.calls[0][1]).toMatchObject({ p_query: 'Rossi' })
  })

  it('se la ricerca fallisce lo dice con `failed`, senza risultati e senza lanciare', async () => {
    rpcMock.mockResolvedValue({ data: null, error: { message: 'boom' } })
    const { result } = renderHook(() => useMemberSearch('Rossi'), { wrapper })
    await waitFor(() => expect(result.current.failed).toBe(true))
    expect(result.current.results).toEqual([])
  })
})

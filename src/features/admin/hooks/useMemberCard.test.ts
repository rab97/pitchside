import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }))

vi.mock('@/shared/lib/supabase', () => ({ supabase: { rpc: rpcMock } }))

import { useMemberCard } from './useMemberCard'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useMemberCard', () => {
  it('non interroga niente senza un cliente scelto', async () => {
    const { result } = renderHook(() => useMemberCard(null), { wrapper })
    await waitFor(() => expect(result.current.isPending).toBe(false))
    expect(rpcMock).not.toHaveBeenCalled()
    expect(result.current.card).toBeNull()
  })

  it('converte la data in Date e lascia null quando non c’è storia', async () => {
    rpcMock.mockResolvedValue({
      data: [{
        id: 'm2', name: 'Cliente Nuovo', phone: null, email: null,
        price_list: 'standard', notes: null,
        appearances: 0, missed: 0, last_played: null, usual_field_name: null,
      }],
      error: null,
    })
    const { result } = renderHook(() => useMemberCard('m2'), { wrapper })
    await waitFor(() => expect(result.current.card).not.toBeNull())
    expect(result.current.card).toEqual({
      id: 'm2', name: 'Cliente Nuovo', phone: null, email: null,
      priceList: 'standard', notes: null,
      appearances: 0, missed: 0, lastPlayed: null, usualFieldName: null,
    })
  })

  it('converte last_played in una Date quando c’è', async () => {
    rpcMock.mockResolvedValue({
      data: [{
        id: 'm1', name: 'Abbonato', phone: '333', email: null,
        price_list: 'ridotto', notes: 'contanti',
        appearances: 3, missed: 1,
        last_played: '2026-09-01T18:00:00+00:00', usual_field_name: 'Campo 1',
      }],
      error: null,
    })
    const { result } = renderHook(() => useMemberCard('m1'), { wrapper })
    await waitFor(() => expect(result.current.card).not.toBeNull())
    expect(result.current.card!.lastPlayed).toBeInstanceOf(Date)
    expect(result.current.card!.appearances).toBe(3)
  })
})

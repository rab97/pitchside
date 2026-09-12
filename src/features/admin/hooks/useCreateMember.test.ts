import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { singleMock, insertMock, fromMock } = vi.hoisted(() => {
  const singleMock = vi.fn()
  const selectMock = vi.fn(() => ({ single: singleMock }))
  const insertMock = vi.fn(() => ({ select: selectMock }))
  const fromMock = vi.fn(() => ({ insert: insertMock }))
  return { singleMock, insertMock, fromMock }
})

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))

vi.mock('@/shared/tenant/FacilityProvider', () => ({
  useFacility: () => ({ id: 'f1' }),
}))

import { useCreateMember } from './useCreateMember'
import { isPhoneTaken } from '../utils/memberMessages'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useCreateMember', () => {
  it('crea il cliente e restituisce il suo id', async () => {
    singleMock.mockResolvedValue({ data: { id: 'm9' }, error: null })
    const { result } = renderHook(() => useCreateMember(), { wrapper })
    let id = ''
    await act(async () => { id = await result.current.createMember({ name: ' Mario ', phone: '333 111 22 33' }) })
    expect(id).toBe('m9')
    expect(insertMock).toHaveBeenCalledWith({
      facility_id: 'f1', name: 'Mario', phone: '3331112233',
    })
  })

  it('senza numero scrive null, non una stringa vuota', async () => {
    singleMock.mockResolvedValue({ data: { id: 'm9' }, error: null })
    const { result } = renderHook(() => useCreateMember(), { wrapper })
    await act(() => result.current.createMember({ name: 'Mario', phone: '' }))
    expect(insertMock).toHaveBeenCalledWith({
      facility_id: 'f1', name: 'Mario', phone: null,
    })
  })

  it('rilancia la collisione in modo che il chiamante la riconosca', async () => {
    singleMock.mockResolvedValue({ data: null, error: { code: '23505', message: 'duplicate key' } })
    const { result } = renderHook(() => useCreateMember(), { wrapper })
    let caught: unknown = null
    await act(async () => {
      caught = await result.current.createMember({ name: 'Mario', phone: '3331112233' }).catch((e) => e)
    })
    expect(isPhoneTaken(caught)).toBe(true)
  })
})

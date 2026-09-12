import { createElement, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { updateMock, selectMock, fromMock } = vi.hoisted(() => {
  const selectMock = vi.fn()
  const eqMock = vi.fn(() => ({ select: selectMock }))
  const updateMock = vi.fn(() => ({ eq: eqMock }))
  const fromMock = vi.fn(() => ({ update: updateMock }))
  return { updateMock, selectMock, fromMock }
})

vi.mock('@/shared/lib/supabase', () => ({ supabase: { from: fromMock } }))

import { useUpdateMemberNotes } from './useUpdateMemberNotes'

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return createElement(QueryClientProvider, { client: qc }, children)
}

describe('useUpdateMemberNotes', () => {
  it('salva la nota e chiede indietro la riga scritta', async () => {
    selectMock.mockResolvedValue({ data: [{ id: 'm1' }], error: null })
    const { result } = renderHook(() => useUpdateMemberNotes(), { wrapper })
    await act(() => result.current.saveNotes('m1', 'contanti'))
    expect(updateMock).toHaveBeenCalledWith({ notes: 'contanti' })
    expect(selectMock).toHaveBeenCalled()
    expect(result.current.saveError).toBeNull()
  })

  it('zero righe scritte è un fallimento, anche senza errore', async () => {
    selectMock.mockResolvedValue({ data: [], error: null })
    const { result } = renderHook(() => useUpdateMemberNotes(), { wrapper })
    await act(async () => {
      await result.current.saveNotes('m1', 'contanti').catch(() => {})
    })
    await waitFor(() => expect(result.current.saveError)
      .toBe('Non siamo riusciti a salvare la nota. Riprova.'))
  })

  it('una nota svuotata diventa null, non una stringa vuota', async () => {
    selectMock.mockResolvedValue({ data: [{ id: 'm1' }], error: null })
    const { result } = renderHook(() => useUpdateMemberNotes(), { wrapper })
    await act(() => result.current.saveNotes('m1', '   '))
    expect(updateMock).toHaveBeenCalledWith({ notes: null })
  })
})

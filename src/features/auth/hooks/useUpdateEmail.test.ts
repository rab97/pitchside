import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { updateUserMock } = vi.hoisted(() => ({ updateUserMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { updateUser: updateUserMock } },
}))

import { useUpdateEmail } from './useUpdateEmail'

describe('useUpdateEmail', () => {
  beforeEach(() => updateUserMock.mockReset())

  it('manda la richiesta con l’indirizzo ripulito', async () => {
    updateUserMock.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('  Rossi@Example.com '))
    expect(updateUserMock).toHaveBeenCalledWith({ email: 'rossi@example.com' })
    expect(result.current.sent).toBe(true)
  })

  it('«sent» dice che la mail è partita, non che l’indirizzo è attivo', async () => {
    updateUserMock.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('rossi@example.com'))
    // Nessuna asserzione sulla sessione: l'indirizzo diventa attivo solo dopo
    // il clic sul collegamento, e questo gancio non lo sa e non lo finge.
    expect(result.current.sent).toBe(true)
    expect(result.current.error).toBeNull()
  })

  it('un indirizzo già di un altro account lo dice in italiano', async () => {
    updateUserMock.mockResolvedValue({ data: null, error: { code: 'email_exists' } })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('rossi@example.com'))
    expect(result.current.error)
      .toBe('Questo indirizzo è già collegato a un altro account. Entra con quello, oppure usane uno diverso.')
    expect(result.current.sent).toBe(false)
  })

  it('un secondo tentativo azzera l’esito del primo', async () => {
    updateUserMock.mockResolvedValue({ data: null, error: { code: 'email_exists' } })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('rossi@example.com'))
    expect(result.current.error).not.toBeNull()

    updateUserMock.mockResolvedValue({ data: {}, error: null })
    await act(() => result.current.setEmail('altro@example.com'))
    expect(result.current.error).toBeNull()
    expect(result.current.sent).toBe(true)
  })
})

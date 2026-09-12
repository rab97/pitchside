import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { signOut: signOutMock } },
}))

import { useSignOut } from './useSignOut'

describe('useSignOut', () => {
  beforeEach(() => signOutMock.mockReset())

  it('esce chiamando Supabase', async () => {
    signOutMock.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useSignOut())
    await act(() => result.current.signOut())
    expect(signOutMock).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  it('se non riesce lo dice in italiano invece di restare zitto', async () => {
    signOutMock.mockResolvedValue({ error: new Error('boom') })
    const { result } = renderHook(() => useSignOut())
    await act(() => result.current.signOut())
    expect(result.current.error).toBe('Non siamo riusciti a uscire. Riprova.')
  })
})

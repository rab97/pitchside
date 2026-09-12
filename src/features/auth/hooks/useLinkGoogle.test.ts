import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { linkIdentityMock } = vi.hoisted(() => ({ linkIdentityMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { linkIdentity: linkIdentityMock } },
}))

import { useLinkGoogle } from './useLinkGoogle'

describe('useLinkGoogle', () => {
  beforeEach(() => linkIdentityMock.mockReset())

  it('chiede a Supabase di collegare Google', async () => {
    linkIdentityMock.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useLinkGoogle())
    await act(() => result.current.linkGoogle())
    expect(linkIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }))
    expect(result.current.error).toBeNull()
  })

  it('se il collegamento non è disponibile lo dice, invece di rompersi', async () => {
    linkIdentityMock.mockResolvedValue({
      data: null, error: { message: 'Manual linking is disabled' },
    })
    const { result } = renderHook(() => useLinkGoogle())
    await act(() => result.current.linkGoogle())
    expect(result.current.error).toBe('Non siamo riusciti a collegare Google. Riprova.')
  })
})

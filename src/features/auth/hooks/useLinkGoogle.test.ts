import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { linkIdentityMock } = vi.hoisted(() => ({ linkIdentityMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { linkIdentity: linkIdentityMock } },
}))

import { useLinkGoogle } from './useLinkGoogle'

describe('useLinkGoogle', () => {
  // Le graffe non sono cosmetiche: senza, la freccia restituisce il mock,
  // e un `beforeEach` che restituisce una funzione la fa chiamare da vitest
  // come pulizia dopo ogni test. Con linkIdentityMock che rifiuta, quella
  // chiamata di troppo produce un rifiuto che nessuno raccoglie, e il test
  // fallisce con l'errore che stava provando a gestire.
  beforeEach(() => { linkIdentityMock.mockReset() })

  it('chiede a Supabase di collegare Google', async () => {
    linkIdentityMock.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useLinkGoogle())
    await act(() => result.current.linkGoogle())
    expect(linkIdentityMock).toHaveBeenCalledWith(
      expect.objectContaining({ provider: 'google' }))
    expect(result.current.error).toBeNull()
  })

  // Come negli altri due ganci di questa schermata: il lock di `gotrue-js`
  // solleva, non restituisce, e senza `finally` il pulsante resta disabilitato
  // fino a un ricaricamento.
  it('se la chiamata solleva, il pulsante non resta bloccato', async () => {
    linkIdentityMock.mockRejectedValue(new Error('lock timeout'))
    const { result } = renderHook(() => useLinkGoogle())
    const failure = await act(async () =>
      result.current.linkGoogle().catch((e: unknown) => e))
    expect(failure).toBeInstanceOf(Error)
    expect(result.current.linking).toBe(false)
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

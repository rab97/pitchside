import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { signOut: signOutMock } },
}))

import { useSignOut } from './useSignOut'

describe('useSignOut', () => {
  // Le graffe non sono cosmetiche: senza, la freccia restituisce il mock,
  // e un `beforeEach` che restituisce una funzione la fa chiamare da vitest
  // come pulizia dopo ogni test. Con signOutMock che rifiuta, quella
  // chiamata di troppo produce un rifiuto che nessuno raccoglie, e il test
  // fallisce con l'errore che stava provando a gestire.
  beforeEach(() => { signOutMock.mockReset() })

  it('esce chiamando Supabase', async () => {
    signOutMock.mockResolvedValue({ error: null })
    const { result } = renderHook(() => useSignOut())
    await act(() => result.current.signOut())
    expect(signOutMock).toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  // Come in `useUpdateEmail`: `signOut` passa dal lock di `gotrue-js`, che
  // solleva invece di restituire. Senza `finally` il pulsante «Esci» resta
  // disabilitato per sempre, sul telefono da cui uscire è più urgente.
  it('se la chiamata solleva, il pulsante non resta bloccato', async () => {
    signOutMock.mockRejectedValue(new Error('lock timeout'))
    const { result } = renderHook(() => useSignOut())
    const failure = await act(async () =>
      result.current.signOut().catch((e: unknown) => e))
    expect(failure).toBeInstanceOf(Error)
    expect(result.current.leaving).toBe(false)
  })

  it('se non riesce lo dice in italiano invece di restare zitto', async () => {
    signOutMock.mockResolvedValue({ error: new Error('boom') })
    const { result } = renderHook(() => useSignOut())
    await act(() => result.current.signOut())
    expect(result.current.error).toBe('Non siamo riusciti a uscire. Riprova.')
  })
})

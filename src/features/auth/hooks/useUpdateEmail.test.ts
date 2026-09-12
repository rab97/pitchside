import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { updateUserMock } = vi.hoisted(() => ({ updateUserMock: vi.fn() }))
vi.mock('@/shared/lib/supabase', () => ({
  supabase: { auth: { updateUser: updateUserMock } },
}))

import { useUpdateEmail } from './useUpdateEmail'

describe('useUpdateEmail', () => {
  // Le graffe non sono cosmetiche: senza, la freccia restituisce il mock,
  // e un `beforeEach` che restituisce una funzione la fa chiamare da vitest
  // come pulizia dopo ogni test. Con updateUserMock che rifiuta, quella
  // chiamata di troppo produce un rifiuto che nessuno raccoglie, e il test
  // fallisce con l'errore che stava provando a gestire.
  beforeEach(() => { updateUserMock.mockReset() })

  it('manda la richiesta con l’indirizzo ripulito', async () => {
    updateUserMock.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('  Rossi@Example.com '))
    expect(updateUserMock).toHaveBeenCalledWith({ email: 'rossi@example.com' })
    expect(result.current.sentTo).toBe('rossi@example.com')
  })

  it('«sentTo» dice dov’è andata la mail, non che l’indirizzo è attivo', async () => {
    updateUserMock.mockResolvedValue({ data: {}, error: null })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('rossi@example.com'))
    // Nessuna asserzione sulla sessione: l'indirizzo diventa attivo solo dopo
    // il clic sul collegamento, e questo gancio non lo sa e non lo finge. Qui
    // torna l'indirizzo a cui il messaggio è andato, che è ciò che serve alla
    // schermata per accorgersi da sola di quando quel clic è arrivato.
    expect(result.current.sentTo).toBe('rossi@example.com')
    expect(result.current.error).toBeNull()
  })

  it('un indirizzo già di un altro account lo dice in italiano', async () => {
    updateUserMock.mockResolvedValue({ data: null, error: { code: 'email_exists' } })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('rossi@example.com'))
    expect(result.current.error)
      .toBe('Questo indirizzo è già collegato a un altro account. Entra con quello, oppure usane uno diverso.')
    expect(result.current.sentTo).toBeNull()
  })

  // `updateUser` gira dentro `_acquireLock`, e il suo
  // `NavigatorLockAcquireTimeoutError` viene *sollevato*, non restituito: due
  // schede dell'app aperte insieme se lo contendono. Senza un `finally`,
  // `saving` resta true e il pulsante è morto fino al ricaricamento della
  // pagina — cioè il guasto meno rimediabile fra quelli possibili qui.
  it('se la chiamata solleva, il pulsante non resta bloccato', async () => {
    updateUserMock.mockRejectedValue(new Error('lock timeout'))
    const { result } = renderHook(() => useUpdateEmail())
    const failure = await act(async () =>
      result.current.setEmail('rossi@example.com').catch((e: unknown) => e))
    expect(failure).toBeInstanceOf(Error)
    expect(result.current.saving).toBe(false)
  })

  it('un secondo tentativo azzera l’esito del primo', async () => {
    updateUserMock.mockResolvedValue({ data: null, error: { code: 'email_exists' } })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('rossi@example.com'))
    expect(result.current.error).not.toBeNull()

    updateUserMock.mockResolvedValue({ data: {}, error: null })
    await act(() => result.current.setEmail('altro@example.com'))
    expect(result.current.error).toBeNull()
    expect(result.current.sentTo).toBe('altro@example.com')
  })

  // Ciò che è rimasto del tentativo precedente non parla dell'indirizzo che si
  // sta scrivendo adesso: la schermata chiama questo mentre il cliente digita.
  it('reset dimentica l’esito del tentativo precedente', async () => {
    updateUserMock.mockResolvedValue({ data: null, error: { code: 'email_exists' } })
    const { result } = renderHook(() => useUpdateEmail())
    await act(() => result.current.setEmail('rossi@example.com'))
    expect(result.current.error).not.toBeNull()

    act(() => result.current.reset())
    expect(result.current.error).toBeNull()
    expect(result.current.sentTo).toBeNull()
  })
})

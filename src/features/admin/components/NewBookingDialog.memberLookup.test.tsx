import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NewBookingDialog } from './NewBookingDialog'
import * as searchHook from '../hooks/useMemberSearch'
import * as cardHook from '../hooks/useMemberCard'
import * as createMemberHook from '../hooks/useCreateMember'
import * as createBookingHook from '../hooks/useCreateBooking'
import * as createRecurrenceHook from '../hooks/useCreateRecurrence'
import * as notesHook from '../hooks/useUpdateMemberNotes'
import type { MemberCardData } from '../hooks/useMemberCard'

vi.mock('@/shared/tenant/FacilityProvider', () => ({
  useFacility: () => ({ id: 'f1', min_duration_minutes: 60 }),
}))

const hit = { id: 'm1', name: 'Rossi Luca', phone: '3331112233', hasMissed: false }

const card: MemberCardData = {
  id: 'm1', name: 'Rossi Luca', phone: '3331112233', email: null,
  priceList: 'standard', notes: null,
  appearances: 4, missed: 0, lastPlayed: null, usualFieldName: null,
}

const target = {
  field: { id: 'c1', name: 'Campo 1', kind: 'calcio5' } as never,
  day: new Date('2026-09-17T12:00:00+02:00'),
  startMin: 21 * 60,
}

let createBooking: ReturnType<typeof vi.fn>
let createMember: ReturnType<typeof vi.fn>

// Every hook the dialog reaches is stubbed, and the render still sits inside a
// `QueryClientProvider`: a test that forgot one of them would not fail on the
// thing it asserts, it would throw "No QueryClient set" from whichever hook was
// left real — a failure that reads like the dialog broke.
function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <NewBookingDialog target={target} onClose={() => {}} />
    </QueryClientProvider>,
  )
}

function stubCreateMember(impl: ReturnType<typeof vi.fn>) {
  createMember = impl
  vi.spyOn(createMemberHook, 'useCreateMember').mockReturnValue({
    createMember: createMember as never, creating: false,
  })
}

beforeEach(() => {
  vi.restoreAllMocks()
  createBooking = vi.fn().mockResolvedValue({ price_cents: 2500 })
  vi.spyOn(createBookingHook, 'useCreateBooking').mockReturnValue({
    mutateAsync: createBooking,
  } as never)
  vi.spyOn(createRecurrenceHook, 'useCreateRecurrence').mockReturnValue({
    mutateAsync: vi.fn(),
  } as never)
  vi.spyOn(notesHook, 'useUpdateMemberNotes').mockReturnValue({
    saveNotes: vi.fn(), saving: false, saveError: null,
  })
  stubCreateMember(vi.fn().mockResolvedValue('m9'))
  vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
    results: [hit], isPending: false, failed: false,
  })
  vi.spyOn(cardHook, 'useMemberCard').mockReturnValue({
    card, isPending: false, failed: false,
  })
})

// Same budget, and the same reason, as `NewClosureDialog.test.tsx`: these
// dialog tests are slow because of contention between workers, not because of
// anything they assert. 20s still catches a hang.
const TIMEOUT = 20_000

describe('NewBookingDialog — riconoscere chi telefona', () => {
  it('scegliendo un cliente mostra la sua scheda', async () => {
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: /Rossi Luca/ }))
    await waitFor(() => expect(screen.getByText('Si è presentato 4 volte')).toBeInTheDocument())
  }, TIMEOUT)

  // `ErrorNote`'s own doc comment is this project's doctrine on exactly this
  // failure: a hook that reads `data` and throws away `error` turns a broken
  // network into a false statement. Here the chosen name with nothing under it
  // is visually identical to a customer who genuinely has no history, and the
  // manager prices the call on «nessuna nota, nessuna mancata, listino
  // standard» — none of which was ever read.
  it('se la scheda non si riesce a leggere lo dice, invece di sembrare un cliente senza storia', async () => {
    vi.spyOn(cardHook, 'useMemberCard').mockReturnValue({
      card: null, isPending: false, failed: true,
    })
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: /Rossi Luca/ }))

    await waitFor(() =>
      expect(screen.getByText('Non siamo riusciti a leggere la scheda di questo cliente: puoi comunque prenotare.'))
        .toBeInTheDocument())
  }, TIMEOUT)

  it('una scheda che semplicemente non c’è non è un guasto e non si annuncia', async () => {
    vi.spyOn(cardHook, 'useMemberCard').mockReturnValue({
      card: null, isPending: false, failed: false,
    })
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: /Rossi Luca/ }))

    await waitFor(() => expect(screen.getByText('Rossi Luca')).toBeInTheDocument())
    expect(screen.queryByText(/Non siamo riusciti a leggere la scheda/)).not.toBeInTheDocument()
  }, TIMEOUT)

  it('prenota con l’id del cliente scelto, non con uno indovinato dal nome', async () => {
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: /Rossi Luca/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(createBooking).toHaveBeenCalled())
    expect(createBooking.mock.calls[0][0]).toMatchObject({ memberId: 'm1', source: 'phone' })
  }, TIMEOUT)

  it('senza nessuno scelto non prenota e dice perché', async () => {
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() =>
      expect(screen.getByText('Scegli un cliente dall’elenco, oppure creane uno nuovo.')).toBeInTheDocument())
    expect(createBooking).not.toHaveBeenCalled()
  }, TIMEOUT)

  it('scegliendo un cliente sparisce l’errore che ne chiedeva uno', async () => {
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() =>
      expect(screen.getByText('Scegli un cliente dall’elenco, oppure creane uno nuovo.')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Rossi Luca/ }))
    await waitFor(() =>
      expect(screen.queryByText('Scegli un cliente dall’elenco, oppure creane uno nuovo.'))
        .not.toBeInTheDocument())
  }, TIMEOUT)

  // The button went inert while still reading «Conferma»: the manager presses
  // it, nothing happens, and nothing on screen says why.
  it('mentre nasce il cliente il pulsante dice che sta salvando', () => {
    vi.spyOn(createMemberHook, 'useCreateMember').mockReturnValue({
      createMember: vi.fn() as never, creating: true,
    })
    renderDialog()
    expect(screen.getByRole('button', { name: 'Salvo…' })).toBeDisabled()
  }, TIMEOUT)

  it('creando un cliente nuovo prenota con l’id appena creato', async () => {
    stubCreateMember(vi.fn().mockResolvedValue('m9'))
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: false,
    })
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefono' }), { target: { value: '3339990000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(createMember).toHaveBeenCalledWith({ name: 'Mario Neri', phone: '3339990000' }))
    await waitFor(() => expect(createBooking).toHaveBeenCalled())
    expect(createBooking.mock.calls[0][0]).toMatchObject({ memberId: 'm9' })
  }, TIMEOUT)

  it('se il numero è già di un altro, lo dice invece di far arrivare un errore del database', async () => {
    stubCreateMember(vi.fn().mockRejectedValue({ code: '23505', message: 'duplicate key' }))
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: false,
    })
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefono' }), { target: { value: '3331112233' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() =>
      expect(screen.getByText(/Questo numero è già di un altro cliente/)).toBeInTheDocument())
    expect(createBooking).not.toHaveBeenCalled()
  }, TIMEOUT)

  // §2.7 and §6: the collision has to offer that card, not a sentence telling
  // the manager to search again. Searching again by the name they have fails
  // exactly as it just did — the existing row is under a different spelling,
  // which is why they were creating a customer in the first place. With §2.6's
  // required number this is no longer a corner: it is the one thing that will
  // routinely stop a manager mid-call.
  it('se il numero è già di un altro, offre la sua scheda e sceglierla prenota per lui', async () => {
    stubCreateMember(vi.fn().mockRejectedValue({ code: '23505', message: 'duplicate key' }))
    // Stubbed per term: the collision asks the search for the digits, the
    // field asks it for what was typed into it.
    vi.spyOn(searchHook, 'useMemberSearch').mockImplementation((q: string) => ({
      results: q.trim() === '3331112233' ? [hit] : [],
      isPending: false,
      failed: false,
    }))
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefono' }), { target: { value: '333 111 22 33' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Usa la scheda di Rossi Luca/ })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Usa la scheda di Rossi Luca/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(createBooking).toHaveBeenCalled())
    expect(createBooking.mock.calls[0][0]).toMatchObject({ memberId: 'm1' })
  }, TIMEOUT)

  // The same collision, written the way an Italian writes a number and the way
  // caller ID displays one. The unique index compares `phone_key` — the last
  // ten digits — so `+39 333 111 2233` collides with a row stored as
  // `3331112233`; a lookup by the full digit string then compares twelve
  // digits with ten, finds nobody, and the manager reads a message promising a
  // card that never appears. That is the dead end the whole item exists to
  // remove, so the lookup has to use the key the index used.
  it('offre la scheda anche quando il numero è scritto con il prefisso', async () => {
    stubCreateMember(vi.fn().mockRejectedValue({ code: '23505', message: 'duplicate key' }))
    vi.spyOn(searchHook, 'useMemberSearch').mockImplementation((q: string) => ({
      results: q.trim() === '3331112233' ? [hit] : [],
      isPending: false,
      failed: false,
    }))
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefono' }), { target: { value: '+39 333 111 2233' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Usa la scheda di Rossi Luca/ })).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: /Usa la scheda di Rossi Luca/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(createBooking).toHaveBeenCalled())
    expect(createBooking.mock.calls[0][0]).toMatchObject({ memberId: 'm1' })
  }, TIMEOUT)

  it('se il numero è già di un altro ma la scheda non si trova, dice comunque cosa fare', async () => {
    stubCreateMember(vi.fn().mockRejectedValue({ code: '23505', message: 'duplicate key' }))
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: true,
    })
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefono' }), { target: { value: '3331112233' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))

    await waitFor(() => expect(screen.getByText(/correggi il numero/)).toBeInTheDocument())
    expect(screen.queryByRole('button', { name: /Usa la scheda/ })).not.toBeInTheDocument()
  }, TIMEOUT)

  it('con la ricerca rotta si prenota lo stesso, creando il cliente', async () => {
    stubCreateMember(vi.fn().mockResolvedValue('m9'))
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: true,
    })
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefono' }), { target: { value: '3339990000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(createBooking).toHaveBeenCalled())
    expect(createBooking.mock.calls[0][0]).toMatchObject({ memberId: 'm9' })
  }, TIMEOUT)

  // The hole `resolveMember` used to cover, and the reason it searched by name
  // as well as by phone: a booking can fail *after* the customer has been
  // created — the slot taken in the meantime — and the manager presses
  // «Conferma» again. Creating the same person a second time would hit the
  // unique index on the phone and turn a retry into «questo numero è già di un
  // altro cliente», about the row just written here.
  it('dopo una prenotazione fallita, riprovare non ricrea il cliente appena creato', async () => {
    stubCreateMember(vi.fn().mockResolvedValue('m9'))
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: false,
    })
    createBooking
      .mockRejectedValueOnce(new Error('Questo slot è appena stato prenotato da qualcun altro. Scegline un altro.'))
      .mockResolvedValueOnce({ price_cents: 2500 })

    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefono' }), { target: { value: '3331112233' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())

    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(createBooking).toHaveBeenCalledTimes(2))
    expect(createMember).toHaveBeenCalledTimes(1)
    expect(createBooking.mock.calls[1][0]).toMatchObject({ memberId: 'm9' })
  }, TIMEOUT)

  // The phone is written once, by `createMember`'s insert, and never again:
  // this dialog has no update path and is not getting one — adding a number to
  // an existing customer belongs to the registry, not here. So once the choice
  // is a real row the field must go, or it invites typing a number that is
  // then silently dropped. `MemberCard` shows the number the record actually
  // holds.
  it('su un cliente che esiste già il telefono non è più scrivibile', async () => {
    stubCreateMember(vi.fn().mockResolvedValue('m9'))
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: false,
    })
    createBooking.mockRejectedValueOnce(new Error('Questo slot è appena stato prenotato da qualcun altro. Scegline un altro.'))

    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefono' }), { target: { value: '3339990000' } })

    // The booking fails, the customer exists anyway, and the choice becomes a
    // chosen one — which is exactly when the field must stop being offered.
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByRole('textbox', { name: 'Telefono' })).not.toBeInTheDocument()
  }, TIMEOUT)

  // §2.6: the number is required, and the refusal is a sentence rather than a
  // dead button — the branch already settled that a button that refuses
  // without saying why is worse than one that names what is missing.
  it('senza numero non crea il cliente e dice cosa manca', async () => {
    stubCreateMember(vi.fn().mockResolvedValue('m9'))
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: false,
    })
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))

    const conferma = screen.getByRole('button', { name: 'Conferma' })
    expect(conferma).toBeEnabled()
    fireEvent.click(conferma)

    await waitFor(() =>
      expect(screen.getByText('Serve il numero di telefono: senza, questo cliente non sarà riconoscibile la prossima volta.'))
        .toBeInTheDocument())
    expect(createMember).not.toHaveBeenCalled()
    expect(createBooking).not.toHaveBeenCalled()
  }, TIMEOUT)

  it('un numero fatto di sole parentesi e spazi non conta come numero', async () => {
    stubCreateMember(vi.fn().mockResolvedValue('m9'))
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: false,
    })
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Telefono' }), { target: { value: ' ( ) - ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(createMember).not.toHaveBeenCalled()
  }, TIMEOUT)
})

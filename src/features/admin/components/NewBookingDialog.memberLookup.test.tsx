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

  it('creando un cliente nuovo prenota con l’id appena creato', async () => {
    stubCreateMember(vi.fn().mockResolvedValue('m9'))
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: false,
    })
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(createMember).toHaveBeenCalledWith({ name: 'Mario Neri', phone: '' }))
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

  it('con la ricerca rotta si prenota lo stesso, creando il cliente', async () => {
    stubCreateMember(vi.fn().mockResolvedValue('m9'))
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: true,
    })
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
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
    expect(screen.getByRole('textbox', { name: 'Telefono' })).toBeInTheDocument()

    // The booking fails, the customer exists anyway, and the choice becomes a
    // chosen one — which is exactly when the field must stop being offered.
    fireEvent.click(screen.getByRole('button', { name: 'Conferma' }))
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
    expect(screen.queryByRole('textbox', { name: 'Telefono' })).not.toBeInTheDocument()
  }, TIMEOUT)

  it('creando un cliente senza numero, dice cosa costa', async () => {
    stubCreateMember(vi.fn().mockResolvedValue('m9'))
    vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
      results: [], isPending: false, failed: false,
    })
    renderDialog()
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    expect(screen.getByText('Senza numero questo cliente non sarà riconoscibile la prossima volta.'))
      .toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: 'Telefono' }), { target: { value: '3331112233' } })
    expect(screen.queryByText('Senza numero questo cliente non sarà riconoscibile la prossima volta.'))
      .not.toBeInTheDocument()
  }, TIMEOUT)
})

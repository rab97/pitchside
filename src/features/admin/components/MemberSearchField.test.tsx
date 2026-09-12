import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemberSearchField } from './MemberSearchField'
import * as searchHook from '../hooks/useMemberSearch'

const hit = { id: 'm1', name: 'Rossi Luca', phone: '3331112233', hasMissed: false }

function stubSearch(over: Partial<ReturnType<typeof searchHook.useMemberSearch>> = {}) {
  vi.spyOn(searchHook, 'useMemberSearch').mockReturnValue({
    results: [], isPending: false, failed: false, ...over,
  })
}

describe('MemberSearchField', () => {
  beforeEach(() => vi.restoreAllMocks())

  it('mostra i risultati e sceglierne uno lo comunica al genitore', () => {
    stubSearch({ results: [hit] })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: /Rossi Luca/ }))
    expect(onChoose).toHaveBeenCalledWith({ kind: 'existing', member: hit })
  })

  it('segnala chi ha una mancata presentazione, senza numeri', () => {
    stubSearch({ results: [{ ...hit, hasMissed: true }] })
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={() => {}} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi' } })
    expect(screen.getByLabelText('Ha mancato almeno una prenotazione')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('creare un cliente nuovo è un gesto esplicito, non il ripiego automatico', () => {
    stubSearch({ results: [] })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    expect(onChoose).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    expect(onChoose).toHaveBeenCalledWith({ kind: 'new', name: 'Mario Neri' })
  })

  it('se la ricerca fallisce si può comunque creare il cliente', () => {
    stubSearch({ failed: true })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Mario Neri' } })
    expect(screen.getByText('Non siamo riusciti a cercare fra i clienti: puoi comunque prenotare.'))
      .toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Mario Neri' }))
    expect(onChoose).toHaveBeenCalledWith({ kind: 'new', name: 'Mario Neri' })
  })

  // §2.7b: a confirmation, not a constraint. Two «Marco Rossi» in one facility
  // is ordinary; refusing the second would make the manager write «Marco Rossi
  // 2», which is worse data than two clean rows for as long as the row lives.
  it('un nome già in elenco non crea subito: dice chi c’è già e chiede', () => {
    stubSearch({ results: [hit] })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi Luca' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Rossi Luca' }))

    expect(screen.getByText('C’è già un cliente che si chiama «Rossi Luca». È la stessa persona?'))
      .toBeInTheDocument()
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('alla domanda si può rispondere che è la stessa persona, e si sceglie quella scheda', () => {
    stubSearch({ results: [hit] })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi Luca' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Rossi Luca' }))
    fireEvent.click(screen.getByRole('button', { name: /Usa la scheda di Rossi Luca/ }))
    expect(onChoose).toHaveBeenCalledWith({ kind: 'existing', member: hit })
  })

  // The whole weight of §2.7b: with §2.6's required number two customers
  // sharing a name necessarily hold different numbers, so they are genuinely
  // two people. The manager must be able to say so and go on.
  it('alla domanda si può rispondere che è una persona diversa, e si procede', () => {
    stubSearch({ results: [hit] })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi Luca' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Rossi Luca' }))
    fireEvent.click(screen.getByRole('button', { name: 'No, è una persona diversa' }))

    expect(onChoose).toHaveBeenCalledWith({ kind: 'new', name: 'Rossi Luca' })
    expect(screen.queryByText(/È la stessa persona\?/)).not.toBeInTheDocument()
  })

  it('non richiede la stessa conferma due volte per lo stesso nome', () => {
    stubSearch({ results: [hit] })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi Luca' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Rossi Luca' }))
    fireEvent.click(screen.getByRole('button', { name: 'No, è una persona diversa' }))
    onChoose.mockClear()

    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Rossi Luca' }))
    expect(screen.queryByText(/È la stessa persona\?/)).not.toBeInTheDocument()
    expect(onChoose).toHaveBeenCalledWith({ kind: 'new', name: 'Rossi Luca' })
  })

  it('confronta il nome come lo confronta il database: senza accenti e senza maiuscole', () => {
    stubSearch({ results: [{ ...hit, id: 'm2', name: 'Nicolò Bianchi' }] })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'nicolo bianchi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: nicolo bianchi' }))

    expect(screen.getByText('C’è già un cliente che si chiama «Nicolò Bianchi». È la stessa persona?'))
      .toBeInTheDocument()
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('se i clienti con quel nome sono più di uno, li offre tutti', () => {
    const anna = { id: 'm3', name: 'Marco Rossi', phone: '3331110001', hasMissed: false }
    const bruno = { id: 'm4', name: 'Marco Rossi', phone: '3331110002', hasMissed: false }
    stubSearch({ results: [anna, bruno] })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Marco Rossi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Marco Rossi' }))

    expect(screen.getByText('Ci sono già 2 clienti che si chiamano «Marco Rossi». È una di loro?'))
      .toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Usa la scheda di Marco Rossi\s*3331110002/ }))
    expect(onChoose).toHaveBeenCalledWith({ kind: 'existing', member: bruno })
  })

  it('un nome che assomiglia a un altro senza esserlo non fa domande', () => {
    stubSearch({ results: [hit] })
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'none' }} onChoose={onChoose} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Cliente' }), { target: { value: 'Rossi Luigi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Nuovo cliente: Rossi Luigi' }))
    expect(onChoose).toHaveBeenCalledWith({ kind: 'new', name: 'Rossi Luigi' })
  })

  it('un cliente scelto si può cambiare', () => {
    stubSearch()
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'existing', member: hit }} onChoose={onChoose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cambia cliente' }))
    expect(onChoose).toHaveBeenCalledWith({ kind: 'none' })
  })
})

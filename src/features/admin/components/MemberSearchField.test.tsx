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

  it('un cliente scelto si può cambiare', () => {
    stubSearch()
    const onChoose = vi.fn()
    render(<MemberSearchField choice={{ kind: 'existing', member: hit }} onChoose={onChoose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Cambia cliente' }))
    expect(onChoose).toHaveBeenCalledWith({ kind: 'none' })
  })
})

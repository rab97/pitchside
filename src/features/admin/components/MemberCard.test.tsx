import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MemberCard } from './MemberCard'
import type { MemberCardData } from '../hooks/useMemberCard'

const base: MemberCardData = {
  id: 'm1', name: 'Rossi Luca', phone: '3331112233', email: null,
  priceList: 'standard', notes: null,
  appearances: 0, missed: 0, lastPlayed: null, usualFieldName: null,
}

describe('MemberCard', () => {
  it('un cliente senza storia è «nuovo», non uno allo zero per cento', () => {
    render(<MemberCard card={base} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByText('Cliente nuovo')).toBeInTheDocument()
    expect(screen.queryByText(/%/)).not.toBeInTheDocument()
  })

  it('conta le presenze e le mancate a parole, senza percentuali', () => {
    render(<MemberCard card={{ ...base, appearances: 23, missed: 2 }} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByText('Si è presentato 23 volte, 2 mancate')).toBeInTheDocument()
  })

  it('al singolare concorda: una volta, una mancata', () => {
    render(<MemberCard card={{ ...base, appearances: 1, missed: 1 }} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByText('Si è presentato 1 volta, 1 mancata')).toBeInTheDocument()
  })

  it('senza mancate non nomina le mancate', () => {
    render(<MemberCard card={{ ...base, appearances: 5, missed: 0 }} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByText('Si è presentato 5 volte')).toBeInTheDocument()
  })

  it('mostra il listino solo quando non è quello standard', () => {
    const { rerender } = render(<MemberCard card={base} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.queryByText(/Listino/)).not.toBeInTheDocument()
    rerender(<MemberCard card={{ ...base, priceList: 'ridotto' }} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByText('Listino ridotto')).toBeInTheDocument()
  })

  it('dice il campo abituale quando c’è', () => {
    render(<MemberCard card={{ ...base, appearances: 3, usualFieldName: 'Campo 1' }} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByText(/Di solito Campo 1/)).toBeInTheDocument()
  })

  it('salva le note uscendo dal campo, non con un pulsante', () => {
    const onNotesBlur = vi.fn()
    render(<MemberCard card={base} onNotesBlur={onNotesBlur} saveError={null} />)
    const notes = screen.getByRole('textbox', { name: 'Note interne' })
    fireEvent.change(notes, { target: { value: 'Paga in contanti' } })
    expect(onNotesBlur).not.toHaveBeenCalled()
    fireEvent.blur(notes)
    expect(onNotesBlur).toHaveBeenCalledWith('Paga in contanti')
  })

  it('non risalva una nota che non è cambiata', () => {
    const onNotesBlur = vi.fn()
    render(<MemberCard card={{ ...base, notes: 'Paga in contanti' }} onNotesBlur={onNotesBlur} saveError={null} />)
    fireEvent.blur(screen.getByRole('textbox', { name: 'Note interne' }))
    expect(onNotesBlur).not.toHaveBeenCalled()
  })

  it('dice se il salvataggio della nota non è riuscito', () => {
    render(<MemberCard card={base} onNotesBlur={() => {}} saveError="Non siamo riusciti a salvare la nota. Riprova." />)
    expect(screen.getByText('Non siamo riusciti a salvare la nota. Riprova.')).toBeInTheDocument()
  })

  it('cambiando cliente non mostra la bozza non salvata del precedente', () => {
    const memberB: MemberCardData = { ...base, id: 'm2', name: 'Bianchi Anna', notes: 'Nota di Anna' }
    const { rerender } = render(<MemberCard card={base} onNotesBlur={() => {}} saveError={null} />)
    fireEvent.change(screen.getByRole('textbox', { name: 'Note interne' }), { target: { value: 'Bozza su Rossi mai inviata' } })
    rerender(<MemberCard card={memberB} onNotesBlur={() => {}} saveError={null} />)
    expect(screen.getByRole('textbox', { name: 'Note interne' })).toHaveValue('Nota di Anna')
    expect(screen.queryByText('Bozza su Rossi mai inviata')).not.toBeInTheDocument()
  })
})

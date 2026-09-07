import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DayStrip } from './DayStrip'

// `DayStrip` non possiede `day`: lo riceve dal genitore, come fa `BookPage`.
// Questo wrapper minimo lo tiene in uno stato locale e offre un pulsante che
// lo cambia dall'esterno, così da poter simulare sia una scelta del
// `DateJump` sia il ripristino post-accesso — entrambi arrivano come un
// nuovo `day`, non come un clic sulla striscia stessa.
function Harness({ initialDay, jumpTo }: { initialDay: Date; jumpTo: Date }) {
  const [day, setDay] = useState(initialDay)
  return (
    <div>
      <button onClick={() => setDay(jumpTo)}>salta</button>
      <DayStrip day={day} onSelect={setDay} horizonDays={60} />
    </div>
  )
}

const TODAY = new Date('2026-09-07T10:00:00+02:00')       // lunedì
const FAR_DAY = new Date('2026-10-20T00:00:00+02:00')     // fuori dalla prima finestra

describe('DayStrip — la finestra segue day quando cade fuori dalla settimana', () => {
  beforeEach(() => vi.setSystemTime(TODAY))
  afterEach(() => vi.useRealTimers())

  it('si sposta a contenere una data scelta fuori dalla finestra corrente', () => {
    render(<Harness initialDay={TODAY} jumpTo={FAR_DAY} />)
    fireEvent.click(screen.getByRole('button', { name: 'salta' }))

    expect(screen.getByRole('button', { pressed: true })).toHaveTextContent('20')
  })

  it('non si riallinea da sola mentre si sfoglia con le frecce dopo il salto', () => {
    render(<Harness initialDay={TODAY} jumpTo={FAR_DAY} />)
    fireEvent.click(screen.getByRole('button', { name: 'salta' }))

    // Due settimane in avanti: se l'effetto guardasse anche `windowStart`
    // (invece che solo `day`) tornerebbe subito a contenere il 20 ottobre,
    // e sfogliare oltre la sua settimana diventerebbe impossibile.
    const forward = screen.getByRole('button', { name: 'Settimana successiva' })
    fireEvent.click(forward)
    fireEvent.click(forward)
    expect(screen.queryByRole('button', { pressed: true })).toBeNull()

    // Tornando indietro delle stesse due settimane il 20 ottobre ricompare:
    // la finestra si è solo spostata sfogliando, non ha perso il giorno.
    const back = screen.getByRole('button', { name: 'Settimana precedente' })
    fireEvent.click(back)
    fireEvent.click(back)
    expect(screen.getByRole('button', { pressed: true })).toHaveTextContent('20')
  })
})

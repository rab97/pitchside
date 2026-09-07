import { describe, expect, it } from 'vitest'
import { dragThreshold, heightWhileDragging, settleDrag } from './sheetDrag'

describe('dragThreshold', () => {
  it('è il 30% della corsa dove la corsa è lunga', () => {
    expect(dragThreshold(300)).toBe(90)
  })

  it('non scende sotto i 40px su un foglio corto', () => {
    // Il 30% di 100 sarebbe 30: sotto quella distanza un tocco con la mano
    // ferma passerebbe per trascinamento.
    expect(dragThreshold(100)).toBe(40)
    expect(dragThreshold(0)).toBe(40)
  })
})

describe('settleDrag', () => {
  const travel = 200 // soglia 60

  it('trascinando in su apre', () => {
    expect(settleDrag({ dy: -61, travel })).toBe('open')
  })

  it('trascinando in giù chiude', () => {
    expect(settleDrag({ dy: 61, travel })).toBe('closed')
  })

  it('un gesto corto non decide: il foglio torna dov’era', () => {
    expect(settleDrag({ dy: -59, travel })).toBe('unchanged')
    expect(settleDrag({ dy: 59, travel })).toBe('unchanged')
    expect(settleDrag({ dy: 0, travel })).toBe('unchanged')
  })

  it('esattamente sulla soglia scatta', () => {
    expect(settleDrag({ dy: -60, travel })).toBe('open')
    expect(settleDrag({ dy: 60, travel })).toBe('closed')
  })
})

describe('heightWhileDragging', () => {
  it('segue il dito verso l’alto partendo da chiuso', () => {
    expect(heightWhileDragging({ base: 0, dy: -50, travel: 200 })).toBe(50)
  })

  it('segue il dito verso il basso partendo da aperto', () => {
    expect(heightWhileDragging({ base: 200, dy: 50, travel: 200 })).toBe(150)
  })

  it('non cresce oltre il contenuto né scende sotto zero', () => {
    expect(heightWhileDragging({ base: 0, dy: -900, travel: 200 })).toBe(200)
    expect(heightWhileDragging({ base: 200, dy: 900, travel: 200 })).toBe(0)
  })
})

import { describe, expect, it } from 'vitest'
import { splitClosures } from './splitClosures'
import type { Closure } from '../hooks/useClosures'

const now = new Date('2026-09-11T10:00:00Z')

function closure(overrides: Partial<Closure>): Closure {
  return {
    id: 'c1',
    field_id: 'f1',
    field_name: 'Campo 1',
    starts_at: new Date('2026-09-15T08:00:00Z'),
    ends_at: new Date('2026-09-15T18:00:00Z'),
    reason: null,
    ...overrides,
  }
}

describe('splitClosures', () => {
  it('mette fra le prossime una chiusura non ancora terminata', () => {
    const c = closure({ id: 'u1' })
    const { upcoming, past } = splitClosures([c], now)
    expect(upcoming.map((x) => x.id)).toEqual(['u1'])
    expect(past).toHaveLength(0)
  })

  it('una chiusura già in corso resta fra le prossime', () => {
    const c = closure({
      id: 'ongoing',
      starts_at: new Date('2026-09-10T08:00:00Z'),
      ends_at: new Date('2026-09-12T08:00:00Z'),
    })
    const { upcoming, past } = splitClosures([c], now)
    expect(upcoming.map((x) => x.id)).toEqual(['ongoing'])
    expect(past).toHaveLength(0)
  })

  it('mette fra le passate una chiusura già terminata', () => {
    const c = closure({
      id: 'p1',
      starts_at: new Date('2026-09-01T08:00:00Z'),
      ends_at: new Date('2026-09-02T08:00:00Z'),
    })
    const { upcoming, past } = splitClosures([c], now)
    expect(upcoming).toHaveLength(0)
    expect(past.map((x) => x.id)).toEqual(['p1'])
  })

  it('le prossime sono ordinate dalla più vicina alla più lontana', () => {
    const near = closure({
      id: 'near', starts_at: new Date('2026-09-12T08:00:00Z'), ends_at: new Date('2026-09-12T18:00:00Z'),
    })
    const far = closure({
      id: 'far', starts_at: new Date('2026-09-20T08:00:00Z'), ends_at: new Date('2026-09-20T18:00:00Z'),
    })
    const { upcoming } = splitClosures([far, near], now)
    expect(upcoming.map((x) => x.id)).toEqual(['near', 'far'])
  })

  it('le passate sono ordinate dalla più recente alla più lontana', () => {
    const recent = closure({
      id: 'recent', starts_at: new Date('2026-09-05T08:00:00Z'), ends_at: new Date('2026-09-05T18:00:00Z'),
    })
    const old = closure({
      id: 'old', starts_at: new Date('2026-08-01T08:00:00Z'), ends_at: new Date('2026-08-01T18:00:00Z'),
    })
    const { past } = splitClosures([old, recent], now)
    expect(past.map((x) => x.id)).toEqual(['recent', 'old'])
  })
})

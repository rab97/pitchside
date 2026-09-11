import { describe, expect, it } from 'vitest'
import { reorder, sortOrderPatches } from './reorder'

const a = { id: 'a', sort_order: 1 }
const b = { id: 'b', sort_order: 2 }
const c = { id: 'c', sort_order: 3 }

describe('reorder', () => {
  it('moves an item down', () => {
    expect(reorder([a, b, c], 0, 2).map((f) => f.id)).toEqual(['b', 'c', 'a'])
  })

  it('moves an item up', () => {
    expect(reorder([a, b, c], 2, 0).map((f) => f.id)).toEqual(['c', 'a', 'b'])
  })

  it('a move to the same place changes nothing', () => {
    expect(reorder([a, b, c], 1, 1).map((f) => f.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('sortOrderPatches', () => {
  it('renumbers positions from one', () => {
    expect(sortOrderPatches([c, a, b])).toEqual([
      { id: 'c', sort_order: 1 },
      { id: 'a', sort_order: 2 },
      { id: 'b', sort_order: 3 },
    ])
  })

  it('returns only the rows that actually move', () => {
    // Dragging the last pitch one place up must not rewrite the first.
    expect(sortOrderPatches([a, c, b])).toEqual([
      { id: 'c', sort_order: 2 },
      { id: 'b', sort_order: 3 },
    ])
  })

  it('returns nothing when the order is already right', () => {
    expect(sortOrderPatches([a, b, c])).toEqual([])
  })
})
